import { NativeTabs } from 'expo-router/native-tabs';
import { Platform, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/** Native bottom tabs: Início, Extrato, Cartões and Planejar. */
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      // iOS draws its own translucent, blurred bar; Android gets the app background.
      backgroundColor={Platform.OS === 'ios' ? undefined : colors.background}
      blurEffect={Platform.OS === 'ios' ? 'systemChromeMaterial' : undefined}
      indicatorColor={colors.primarySoft}
      rippleColor={colors.primarySoft}
      iconColor={{ selected: colors.accent }}
      labelStyle={{ selected: { color: colors.accent, fontWeight: '600' } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="extrato">
        <NativeTabs.Trigger.Label>Extrato</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'list.bullet.rectangle', selected: 'list.bullet.rectangle.fill' }} md="receipt_long" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="cards">
        <NativeTabs.Trigger.Label>Cartões</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'creditcard', selected: 'creditcard.fill' }} md="credit_card" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="plan">
        <NativeTabs.Trigger.Label>Planejar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="slider.horizontal.3" md="tune" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
