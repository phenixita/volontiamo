import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '../../lib/auth';
import { formatUserType } from '../../lib/types';
import { colors, typography } from '../../theme';
import { AppText } from '../../components/AppText';

export default function ProfileScreen() {
  const router = useRouter();
  const { status, user, signOut } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand.red} />
      </View>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Redirect href="/" />;
  }

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <View style={styles.page}>
      <View style={styles.identityCard}>
        <AppText style={styles.name}>{user.firstName} {user.lastName}</AppText>
        <AppText style={styles.email}>{user.email}</AppText>
        <View style={styles.typeBadge}>
          <AppText style={styles.typeText}>{formatUserType(user.userType)}</AppText>
        </View>
      </View>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <AppText style={styles.signOutText}>Esci</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.background.page,
  },
  identityCard: {
    backgroundColor: colors.background.raised,
    borderRadius: 16,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
  },
  name: {
    ...typography.titleLarge,
    color: colors.text.strong,
  },
  email: {
    ...typography.body,
    color: colors.text.soft,
    marginTop: 4,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.brand.redSoft,
  },
  typeText: {
    ...typography.caption,
    color: colors.brand.red,
  },
  signOutButton: {
    minHeight: 50,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.raised,
  },
  signOutText: {
    ...typography.titleMedium,
    color: colors.text.strong,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});