import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { colors, typography } from '../theme';

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
        <Text style={styles.loadingText}>Apertura sessione...</Text>
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
        <Text style={styles.title}>Volontiamo</Text>
        <Text style={styles.subtitle}>Accesso volontario</Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
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
            <Text style={styles.label}>Password</Text>
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
            <Text style={styles.errorText}>{formError ?? sessionError}</Text>
          ) : null}

          <Pressable
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.text.inverse} />
            ) : (
              <Text style={styles.submitText}>Entra</Text>
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
