import { Drawer } from 'expo-router/drawer';
import { useRouter } from 'expo-router';
import { DrawerContentComponentProps, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '../lib/auth';
import { NotificationsProvider, useNotifications } from '../lib/notifications';
import { formatUserType } from '../lib/types';
import { colors, typography } from '../theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="dark" />
      <AuthProvider>
        <NotificationsProvider>
          <AppDrawer />
        </NotificationsProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function AppDrawer() {
  const { unreadCount } = useNotifications();

  return (
      <Drawer
        drawerContent={props => <SessionDrawerContent {...props} />}
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
            headerShown: false,
          }}
        />
        <Drawer.Screen
          name="(drawer)/notifications"
          options={{
            drawerLabel: ({ color }) => (
              <View style={styles.drawerLabelRow}>
                <Text style={[styles.drawerLabelText, { color }]}>Notifiche</Text>
                {unreadCount > 0 ? (
                  <View style={styles.drawerBadge}>
                    <Text style={styles.drawerBadgeText}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
                  </View>
                ) : null}
              </View>
            ),
            title: 'Notifiche',
            headerShown: false,
          }}
        />
        <Drawer.Screen
          name="(drawer)/profile"
          options={{
            drawerLabel: 'Profilo',
            title: 'Profilo',
          }}
        />
        <Drawer.Screen
          name="(drawer)/stats"
          options={{
            drawerLabel: 'Statistiche',
            title: 'Statistiche',
          }}
        />
      </Drawer>
  );
}

function SessionDrawerContent(props: DrawerContentComponentProps) {
  const router = useRouter();
  const { user, status, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
      {status === 'authenticated' && user ? (
        <View style={styles.drawerIdentity}>
          <Text style={styles.drawerName} numberOfLines={1}>
            {user.firstName} {user.lastName}
          </Text>
          <Text style={styles.drawerEmail} numberOfLines={1}>{user.email}</Text>
          <Text style={styles.drawerType}>{formatUserType(user.userType)}</Text>
        </View>
      ) : null}
      <DrawerItemList {...props} />
      {status === 'authenticated' ? (
        <Pressable style={styles.drawerSignOut} onPress={handleSignOut}>
          <Text style={styles.drawerSignOutText}>Esci</Text>
        </Pressable>
      ) : null}
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  drawerContent: {
    flexGrow: 1,
    paddingTop: 12,
  },
  drawerIdentity: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.background.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
  },
  drawerName: {
    ...typography.titleMedium,
    color: colors.text.strong,
  },
  drawerEmail: {
    ...typography.bodySmall,
    color: colors.text.soft,
    marginTop: 2,
  },
  drawerType: {
    ...typography.caption,
    color: colors.brand.red,
    marginTop: 8,
  },
  drawerSignOut: {
    marginTop: 'auto',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
  },
  drawerSignOutText: {
    ...typography.titleMedium,
    color: colors.text.strong,
  },
  drawerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerLabelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  drawerBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.red,
  },
  drawerBadgeText: {
    ...typography.caption,
    color: colors.text.inverse,
    fontWeight: '700',
  },
});
