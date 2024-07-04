import { GraphQLResponse } from 'relay-runtime';
import { Client as WebsocketClient } from 'graphql-ws';
import { Observable, filter, merge, mergeMap } from 'rxjs';
import { Exchange, OperationResult } from './layer';
import { OperationError } from './OperationError';

export function subscriptionExchange(client: WebsocketClient): Exchange {
  return ({ forward }) =>
    (operations$) => {
      const subscriptions$ = operations$.pipe(
        filter(({ kind }) => kind === 'subscription'),
        mergeMap((op) => {
          return new Observable<OperationResult>((sink) =>
            client.subscribe<GraphQLResponse>(
              {
                operationName: op.name,
                query: op.text || '',
                variables: op.variables,
              },
              {
                next(value) {
                  console.log('SUBSCRIPTION NEXT', { value });
                  sink.next({ errors: [], operation: op, ...value, data: value.data || undefined });
                  // if (value.data) {
                  //   if (Array.isArray(value.data)) {
                  //     (value.data as GraphQLSingularResponse[]).forEach((r) =>
                  //       sink.next({ errors: [], request: op, ...r, data: r.data || undefined }),
                  //     );
                  //   } else {
                  //     const r = value.data as GraphQLSingularResponse;
                  //     sink.next({ errors: [], request: op, ...r, data: r.data || undefined });
                  //   }
                  // }
                },
                error(error: Error) {
                  sink.error(new OperationError(op, undefined, error));
                },
                complete() {
                  sink.complete();
                },
              },
            ),
          );
        }),
      );

      const forward$ = operations$.pipe(
        filter(({ kind }) => kind !== 'subscription'),
        forward,
      );

      return merge(subscriptions$, forward$);
    };
}
