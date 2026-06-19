import { Drawer } from 'expo-router/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="dark" />
      <Drawer
        screenOptions={{
          drawerStyle: {
            backgroundColor: colors.background.shell,
          },
          drawerActiveTintColor: colors.brand.red,
          drawerInactiveTintColor: colors.text.soft,
          drawerLabelStyle: {
            fontSize: 15,
            fontWeight: '600',
          },
          headerStyle: {
            backgroundColor: colors.background.raised,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border.subtle,
          },
          headerTintColor: colors.text.strong,
          headerTitleStyle: {
            fontSize: 17,
            fontWeight: '700',
            color: colors.text.strong,
          },
          sceneStyle: {
            backgroundColor: colors.background.page,
          },
        }}
      >
        <Drawer.Screen
          name="(drawer)/events"
          options={{
            drawerLabel: 'Eventi',
            title: 'Eventi',
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
