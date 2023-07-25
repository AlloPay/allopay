import {
  useQuery as useBaseQuery,
  UseQueryArgs,
  AnyVariables,
  UseQueryState,
  DocumentInput,
  UseQueryExecute,
} from 'urql';
import { DocumentNode, Kind } from 'graphql';
import * as gen from '~/gql/api/generated';

type Options<Data, Variables extends AnyVariables> = Omit<
  UseQueryArgs<Variables, Data>,
  'query' | 'variables'
>;

type OptionalVariables = undefined | Record<string, never>;

type QueryResponse<Data, Variables extends AnyVariables> = Omit<
  UseQueryState<Data, Variables>,
  'data'
> & { data: Data; reexecute: UseQueryExecute };

export function useQuery<Data, Variables extends AnyVariables>(
  // Check whether the variables are optional
  ...[query, variables, options]: Variables extends OptionalVariables
    ? [
        query: DocumentInput<Data, Variables>,
        variables?: Variables,
        options?: Options<Data, Variables>,
      ]
    : [
        query: DocumentInput<Data, Variables>,
        variables: Variables,
        options?: Options<Data, Variables>,
      ]
) {
  const [response, reexecute] = useBaseQuery({
    ...options,
    query: tryReplaceDocument(query),
    variables: variables!,
  });

  const r = response as QueryResponse<Data, Variables>;
  r.reexecute = reexecute;

  return r;
}

const CACHED_REPLACEMENTS = new Map<DocumentInput<unknown, unknown>, DocumentNode | null>();

export function tryReplaceDocument<Data, Variables>(
  doc: DocumentInput<Data, Variables>,
): DocumentInput<Data, Variables> {
  // Replace document with Relay compiler optimized version (from api/generated)
  const cachedMatch = CACHED_REPLACEMENTS.get(doc);
  if (cachedMatch) return cachedMatch;
  if (cachedMatch === null) return doc;

  if (typeof doc === 'object' && doc.definitions.length >= 1) {
    const def = doc.definitions[0];

    if (def.kind === Kind.OPERATION_DEFINITION && def.name) {
      const matchingDocument = gen[`${def.name.value}Document` as keyof typeof gen];
      if (typeof matchingDocument === 'object') {
        CACHED_REPLACEMENTS.set(doc, matchingDocument);
        return matchingDocument;
      }
    }
  }

  CACHED_REPLACEMENTS.set(doc, null);
  return doc;
}
