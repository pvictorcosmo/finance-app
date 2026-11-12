import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { useSeriesColor } from '@/constants/series-colors';

type SymbolName = SymbolViewProps['name'];

/**
 * Ícones do app: SF Symbols no iOS e Material Symbols no Android/web (via expo-symbols).
 * Use sempre uma chave daqui, para o mesmo ícone aparecer em todas as plataformas.
 */
const ICONS = {
  // categorias
  cart: { ios: 'cart.fill', android: 'shopping_cart', web: 'shopping_cart' },
  food: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' },
  car: { ios: 'car.fill', android: 'directions_car', web: 'directions_car' },
  fun: { ios: 'gamecontroller.fill', android: 'sports_esports', web: 'sports_esports' },
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  health: { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
  bag: { ios: 'bag.fill', android: 'shopping_bag', web: 'shopping_bag' },
  gift: { ios: 'gift.fill', android: 'redeem', web: 'redeem' },
  book: { ios: 'book.fill', android: 'menu_book', web: 'menu_book' },
  pet: { ios: 'pawprint.fill', android: 'pets', web: 'pets' },
  plane: { ios: 'airplane', android: 'flight', web: 'flight' },
  bolt: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
  phone: { ios: 'iphone', android: 'smartphone', web: 'smartphone' },
  gym: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' },
  coffee: { ios: 'cup.and.saucer.fill', android: 'local_cafe', web: 'local_cafe' },
  tag: { ios: 'tag.fill', android: 'sell', web: 'sell' },
  // interface
  add: { ios: 'plus', android: 'add', web: 'add' },
  card: { ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' },
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  chevronLeft: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  chevronUp: { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  person: { ios: 'person.fill', android: 'person', web: 'person' },
  savings: { ios: 'banknote.fill', android: 'savings', web: 'savings' },
  income: { ios: 'arrow.down.left', android: 'south_west', web: 'south_west' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
  chart: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
  bill: { ios: 'doc.text.fill', android: 'receipt_long', web: 'receipt_long' },
  repeat: { ios: 'repeat', android: 'repeat', web: 'repeat' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
  clock: { ios: 'clock.fill', android: 'schedule', web: 'schedule' },
  bell: { ios: 'bell.fill', android: 'notifications', web: 'notifications' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  send: { ios: 'paperplane.fill', android: 'send', web: 'send' },
  download: { ios: 'tray.and.arrow.down.fill', android: 'download', web: 'download' },
  undo: { ios: 'arrow.uturn.backward', android: 'undo', web: 'undo' },
  key: { ios: 'key.fill', android: 'key', web: 'key' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  filter: { ios: 'line.3.horizontal.decrease', android: 'filter_list', web: 'filter_list' },
  eye: { ios: 'eye', android: 'visibility', web: 'visibility' },
  eyeOff: { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  list: { ios: 'list.bullet.rectangle', android: 'receipt_long', web: 'receipt_long' },
  contactless: { ios: 'wave.3.right', android: 'contactless', web: 'contactless' },
  backspace: { ios: 'delete.left', android: 'backspace', web: 'backspace' },
} satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;

/** Ícones que o usuário pode escolher para uma categoria. */
export const CATEGORY_ICONS: IconName[] = [
  'cart', 'food', 'car', 'fun', 'home', 'health', 'bag', 'gift',
  'book', 'pet', 'plane', 'bolt', 'phone', 'gym', 'coffee', 'tag',
];

/** Ícone sugerido pelo nome da categoria (usado quando ela ainda não tem um). */
export function guessCategoryIcon(name: string): IconName {
  const n = name.toLocaleLowerCase('pt-BR');
  const rules: [RegExp, IconName][] = [
    [/uber|99|táxi|taxi|transporte|carro|gasolina|combust|ônibus|onibus|metr/, 'car'],
    [/almo|comida|restaur|lanche|ifood|janta|refei/, 'food'],
    [/lazer|jogo|game|cinema|show|festa|bar/, 'fun'],
    [/mercado|dia a dia|feira|compras/, 'cart'],
    [/casa|aluguel|condom/, 'home'],
    [/saúde|saude|farm|médic|medic/, 'health'],
    [/roupa|shopping|loja/, 'bag'],
    [/presente/, 'gift'],
    [/curso|livro|estud|educa/, 'book'],
    [/pet|cachorro|gato/, 'pet'],
    [/viage|passag/, 'plane'],
    [/luz|energia|conta/, 'bolt'],
    [/celular|internet|assinatura|streaming/, 'phone'],
    [/academia|gym|esporte/, 'gym'],
    [/café|cafe|padaria/, 'coffee'],
  ];
  return rules.find(([re]) => re.test(n))?.[1] ?? 'tag';
}

/** Ícone de uma categoria: o escolhido, ou um sugerido pelo nome. */
export function categoryIcon(category: { name: string; icon?: string }): IconName {
  return category.icon && category.icon in ICONS ? (category.icon as IconName) : guessCategoryIcon(category.name);
}

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: string }) {
  return <SymbolView name={ICONS[name]} size={size} tintColor={color} resizeMode="scaleAspectFit" style={{ width: size, height: size }} />;
}

/** Ícone dentro de um círculo com fundo suave da mesma cor. */
export function IconBadge({ name, color, size = 40 }: { name: IconName; color: string; size?: number }) {
  const series = useSeriesColor();
  const c = series(color);
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${c}22` }]}>
      <Icon name={name} size={size * 0.48} color={c} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
});
