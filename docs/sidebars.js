// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  default: [
    'getting-started',
    {
      type: 'category',
      label: 'Tutorials',
      link: {
        type: 'generated-index',
        slug: 'tutorials',
      },
      items: ['tutorials/transaction', 'tutorials/quorums'],
    },
    {
      type: 'category',
      label: 'Guides',
      link: {
        type: 'generated-index',
        slug: 'guides',
      },
      items: ['guides/setup-nodejs', 'guides/setup-other'],
    },
    {
      type: 'category',
      label: 'Reference',
      link: {
        type: 'generated-index',
        slug: 'reference',
      },
      items: [
        {
          type: 'category',
          label: 'Account',
          link: {
            type: 'doc',
            id: 'reference/account/index',
          },
          items: [
            'reference/account/create',
            'reference/account/query',
            'reference/account/query-many',
          ],
        },
        {
          type: 'category',
          label: 'Proposal',
          link: {
            type: 'doc',
            id: 'reference/proposal/index',
          },
          items: [
            'reference/proposal/create',
            'reference/proposal/approve',
            'reference/proposal/subscribe',
            'reference/proposal/query',
            'reference/proposal/query-many',
          ],
        },
        'reference/authentication',
        {
          type: 'category',
          label: 'Schema',
          items: [
            {
              type: 'autogenerated',
              dirName: 'reference/schema',
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Explanation',
      link: {
        type: 'generated-index',
        slug: 'explanation',
      },
      items: ['explanation/smart-contract'],
    },
  ],
};

module.exports = sidebars;
