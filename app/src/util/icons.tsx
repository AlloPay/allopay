import { ElementType } from 'react';
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from '@expo/vector-icons';
import { ComponentPropsWithoutRef, FC } from 'react';

type NameProp<Props> = Props extends { name: infer Name } ? Name : never;
type Curried<C extends ElementType, Props = ComponentPropsWithoutRef<C>> = (
  name: NameProp<Props>,
) => FC<Omit<Props, 'name'>>;

const material: Curried<typeof MaterialIcons> = (name) => (props) =>
  <MaterialIcons name={name} {...props} />;

const materialCommunity: Curried<typeof MaterialCommunityIcons> =
  (name) => (props) =>
    <MaterialCommunityIcons name={name} {...props} />;

const ionicon: Curried<typeof Ionicons> = (name) => (props) =>
  <Ionicons name={name} {...props} />;

export const ActivityIcon = materialCommunity('chart-timeline-variant');
export const SendIcon = materialCommunity('arrow-up');
export const ReceiveIcon = materialCommunity('arrow-down');
export const ContactsIcon = materialCommunity('contacts');
export const WalletIcon = ionicon('wallet');
