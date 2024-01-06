/** @jsx jsx */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ApolloExplorer } from '@apollo/explorer/react';
import { BaseEmbeddableExplorerOptions as EmbeddedExplorerProps } from '@apollo/explorer/src/EmbeddedExplorer';
import { JSONObject } from '@apollo/explorer/src/helpers/types';
import BrowserOnly from '@docusaurus/BrowserOnly';
import { useColorMode } from '@docusaurus/theme-common';
import { Interpolation, jsx, Theme } from '@emotion/react';
import { useCustomFields } from '@site/src/hooks/useCustomFields';
import { print } from 'graphql';
import gql from 'graphql-tag';

import { useAuthorization, useDevice } from '../hooks/useDevice';

export interface ExplorerProps {
  document: ReturnType<typeof gql>;
  variables?: JSONObject;
  initialState?: Partial<
    EmbeddedExplorerProps['initialState'] & {
      // Force type narrowing to prevent type errors when using document, variables etc.
      collectionId?: never;
      operationId?: never;
    }
  >;
  persistExplorerState?: EmbeddedExplorerProps['persistExplorerState'];
  style?: Interpolation<Theme>;
}

const Explorer = ({
  document: documentProp,
  variables,
  initialState,
  persistExplorerState = false,
  style,
}: ExplorerProps) => {
  const { colorMode } = useColorMode();
  const { apolloGraphRef } = useCustomFields();

  const document = print(documentProp);
  const docLines = document.split('\n').length + 5;

  const variableLines = (JSON.stringify(variables, null, 2)?.split('\n').length ?? 0) + 5;

  const auth = useAuthorization();
  const device = useDevice().address;

  return (
    <ApolloExplorer
      css={style || { height: `${(docLines + variableLines) * 1.75}rem` }}
      graphRef={apolloGraphRef}
      includeCookies
      persistExplorerState={persistExplorerState}
      initialState={{
        ...initialState,
        document,
        variables,
        headers: {
          Authorization: auth,
          device,
          ...initialState?.headers,
        },
        displayOptions: {
          docsPanelState: 'closed',
          showHeadersAndEnvVars: true,
          ...initialState?.displayOptions,
          theme: colorMode,
        },
      }}
    />
  );
};

export default (props: ExplorerProps) => <BrowserOnly>{() => <Explorer {...props} />}</BrowserOnly>;
