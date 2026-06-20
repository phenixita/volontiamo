import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { colors, typography } from '../theme';
import { AppText } from '../components/AppText';

export default function Index() {
  const { status, error: sessionError, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand.red} />
        <AppText style={styles.loadingText}>Apertura sessione...</AppText>
      </View>
    );
  }

  if (status === 'authenticated') {
    return <Redirect href="/(drawer)/events" />;
  }

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setFormError('Inserisci email e password.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    const result = await signIn(email.trim(), password);
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}
    >
      <View style={styles.panel}>
        <AppText style={styles.title}>Volontiamo</AppText>
        <AppText style={styles.subtitle}>Accesso volontario</AppText>

        <View style={styles.form}>
          <View style={styles.field}>
            <AppText style={styles.label}>Email</AppText>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              style={styles.input}
              placeholder="nome@esempio.it"
              placeholderTextColor={colors.text.muted}
            />
          </View>

          <View style={styles.field}>
            <AppText style={styles.label}>Password</AppText>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.text.muted}
            />
          </View>

          {formError || sessionError ? (
            <AppText style={styles.errorText}>{formError ?? sessionError}</AppText>
          ) : null}

          <Pressable
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.text.inverse} />
            ) : (
              <AppText style={styles.submitText}>Entra</AppText>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background.page,
  },
  panel: {
    gap: 18,
  },
  title: {
    ...typography.displayLarge,
    color: colors.text.strong,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.text.soft,
    textAlign: 'center',
  },
  form: {
    marginTop: 8,
    gap: 14,
  },
  field: {
    gap: 6,
  },
  label: {
    ...typography.caption,
    color: colors.text.soft,
  },
  input: {
    ...typography.body,
    minHeight: 50,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.raised,
    color: colors.text.strong,
    paddingHorizontal: 14,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.brand.redDeep,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: colors.brand.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.72,
  },
  submitText: {
    ...typography.titleMedium,
    color: colors.text.inverse,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.page,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.soft,
    marginTop: 12,
  },
});
