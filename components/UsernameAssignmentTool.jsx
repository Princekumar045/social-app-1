import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/Button';
import ScreenWrapper from '../../components/ScreenWrapper';
import { theme } from '../../constants/theme';
import { hp, wp } from '../../helpers/common';
import { assignUsernamesToAllUsers } from '../../services/userServices';

const UsernameAssignmentTool = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handleAssignUsernames = async () => {
    try {
      setLoading(true);
      setResults(null);
      
      const result = await assignUsernamesToAllUsers();
      
      if (result.success) {
        setResults(result);
        Alert.alert(
          'Success', 
          `${result.msg}\n\nUpdated: ${result.updated} users\nFailed: ${result.failed} users`
        );
      } else {
        Alert.alert('Error', result.msg || 'Failed to assign usernames');
      }
    } catch (error) {
      console.error('Error in bulk username assignment:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper bg={theme.colors.background}>
      <View style={styles.container}>
        <Text style={styles.title}>Username Assignment Tool</Text>
        <Text style={styles.description}>
          This tool will assign usernames to all existing users who don't have one.
          Usernames will be generated based on their names.
        </Text>
        
        <Button
          title="Assign Usernames to All Users"
          loading={loading}
          onPress={handleAssignUsernames}
          buttonStyle={styles.button}
        />
        
        {results && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Results:</Text>
            <Text style={styles.resultText}>Updated: {results.updated} users</Text>
            <Text style={styles.resultText}>Failed: {results.failed} users</Text>
            
            {results.results && results.results.length > 0 && (
              <View style={styles.detailsContainer}>
                <Text style={styles.detailsTitle}>Details:</Text>
                {results.results.slice(0, 10).map((result, index) => (
                  <Text key={index} style={styles.detailText}>
                    {result.name} → {result.success ? `@${result.username}` : `Error: ${result.error}`}
                  </Text>
                ))}
                {results.results.length > 10 && (
                  <Text style={styles.moreText}>
                    ... and {results.results.length - 10} more
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </ScreenWrapper>
  );
};

export default UsernameAssignmentTool;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: wp(5),
    gap: hp(2),
  },
  title: {
    fontSize: hp(3),
    fontWeight: theme.fonts.bold,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: hp(1),
  },
  description: {
    fontSize: hp(1.8),
    color: theme.colors.textLight,
    textAlign: 'center',
    marginBottom: hp(2),
    lineHeight: hp(2.5),
  },
  button: {
    marginVertical: hp(2),
  },
  resultsContainer: {
    marginTop: hp(2),
    padding: wp(4),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
  },
  resultsTitle: {
    fontSize: hp(2.2),
    fontWeight: theme.fonts.semibold,
    color: theme.colors.text,
    marginBottom: hp(1),
  },
  resultText: {
    fontSize: hp(1.8),
    color: theme.colors.textDark,
    marginBottom: hp(0.5),
  },
  detailsContainer: {
    marginTop: hp(1.5),
    paddingTop: hp(1.5),
    borderTopWidth: 1,
    borderTopColor: theme.colors.darkLight,
  },
  detailsTitle: {
    fontSize: hp(1.8),
    fontWeight: theme.fonts.medium,
    color: theme.colors.text,
    marginBottom: hp(1),
  },
  detailText: {
    fontSize: hp(1.5),
    color: theme.colors.textLight,
    marginBottom: hp(0.3),
    fontFamily: 'monospace',
  },
  moreText: {
    fontSize: hp(1.5),
    color: theme.colors.primary,
    fontStyle: 'italic',
    marginTop: hp(0.5),
  },
});
