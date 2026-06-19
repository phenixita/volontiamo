import { Stack, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../../../theme';

function DrawerToggle() {
  const navigation = useNavigation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Apri menu"
      hitSlop={8}
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
    >
      <Text style={styles.toggleIcon}>☰</Text>
    </Pressable>
  );
}

export default function EventsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background.raised,
        },
        headerShadowVisible: false,
        headerTintColor: colors.text.strong,
        headerTitleStyle: {
          fontSize: 17,
          fontWeight: '700',
          color: colors.text.strong,
        },
        contentStyle: {
          backgroundColor: colors.background.page,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Eventi',
          headerLeft: () => <DrawerToggle />,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Dettagli evento',
          headerBackTitle: 'Eventi',
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  togglePressed: {
    opacity: 0.6,
  },
  toggleIcon: {
    fontSize: 22,
    color: colors.text.strong,
  },
});
