import { useAddrEns } from '~/components/addr/useAddrEns';
import { ListItem, ListItemProps } from '~/components/list/ListItem';
import { Contact } from '~/queries/contacts/useContacts.api';
import { truncateAddr } from '~/util/format';

export interface ContactItemProps extends Partial<ListItemProps> {
  contact: Contact;
}

export const ContactItem = ({ contact, ...itemProps }: ContactItemProps) => (
  <ListItem
    leading={contact.name}
    headline={contact.name}
    supporting={truncateAddr(contact.addr)}
    trailing={useAddrEns(contact.addr) || undefined}
    {...itemProps}
  />
);
