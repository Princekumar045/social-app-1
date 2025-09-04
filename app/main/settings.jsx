import { useRouter } from "expo-router";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ArrowLeft from "../../assets/icons/ArrowLeft";
import Mail from "../../assets/icons/Mail";
import User from "../../assets/icons/User";
import Logout from "../../assets/icons/logout";
import Header from "../../components/Header";
import ScreenWrapper from "../../components/ScreenWrapper";
import { getTheme } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { hp, wp } from "../../helpers/common";
import { supabase } from "../../lib/supabase";

// Cross-platform alert function
const showAlert = (title, message, buttons = []) => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 1) {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed && buttons[1]?.onPress) {
        buttons[1].onPress();
      } else if (!confirmed && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
    } else {
      window.alert(`${title}\n\n${message}`);
    }
  } else {
    // For mobile, always provide an OK button to dismiss the alert
    const alertButtons = buttons.length > 0 ? buttons : [
      {
        text: "OK",
        style: "default",
      },
    ];
    Alert.alert(title, message, alertButtons);
  }
};

const Settings = () => {
  const { user, setAuth } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const router = useRouter();
  
  // Get current theme
  const theme = getTheme(isDarkMode);

  const onLogout = async () => {
    try {
      console.log("Starting logout process...");
      setAuth(null);
      console.log("Local auth state cleared");

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Supabase logout error:", error.message, error.status);
        showAlert("Sign Out", `Logged out locally. Error: ${error.message}`);
      } else {
        console.log("Supabase logout successful");
      }

      console.log("Navigating to welcome screen...");
      router.replace("/welcome");
    } catch (error) {
      console.error("Logout exception:", error);
      setAuth(null);
      router.replace("/welcome");
      showAlert(
        "Sign Out",
        `Logged out locally. Exception: ${error.message}`
      );
    }
  };

  const handleLogout = () => {
    console.log("Logout button pressed");
    showAlert("Confirm", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        onPress: () => console.log("Logout cancelled"),
        style: "cancel",
      },
      {
        text: "Logout",
        onPress: () => onLogout(),
        style: "destructive",
      },
    ]);
  };

  const SettingsItem = ({ icon, title, subtitle, onPress, rightComponent, showArrow = true }) => (
    <TouchableOpacity style={styles.settingsItem} onPress={onPress}>
      <View style={styles.settingsItemLeft}>
        <View style={styles.iconContainer}>
          {icon}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.settingsTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingsSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.settingsItemRight}>
        {rightComponent}
        {showArrow && !rightComponent && (
          <ArrowLeft 
            size={20} 
            color={theme.colors.textLight} 
            style={{ transform: [{ rotate: '180deg' }] }}
          />
        )}
      </View>
    </TouchableOpacity>
  );

  const SettingsSection = ({ title, children }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );

  // Get dynamic styles based on current theme
  const styles = getStyles(theme);

  return (
    <ScreenWrapper bg={theme.colors.background}>
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.colors.background }]} showsVerticalScrollIndicator={false}>
        <Header title="Settings" showBackButton />

        {/* Appearance Section */}
        <SettingsSection title="Appearance">
          <SettingsItem
            icon={<User size={20} color={theme.colors.primary} />}
            title="Dark Mode"
            subtitle="Toggle dark theme"
            onPress={toggleDarkMode}
            rightComponent={
              <Switch
                value={isDarkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ false: theme.colors.gray, true: theme.colors.primary }}
                thumbColor={isDarkMode ? theme.colors.white : theme.colors.white}
                ios_backgroundColor={theme.colors.gray}
              />
            }
            showArrow={false}
          />
        </SettingsSection>

        {/* Account Section */}
        <SettingsSection title="Account">
          <SettingsItem
            icon={<User size={20} color={theme.colors.primary} />}
            title="Edit Profile"
            subtitle="Update your profile information"
            onPress={() => router.push("/main/editProfile")}
          />
        </SettingsSection>

        {/* Support Section */}
        <SettingsSection title="Support">
          <SettingsItem
            icon={<Mail size={20} color={theme.colors.primary} />}
            title="Help & Support"
            subtitle="Get help and contact support"
            onPress={() => showAlert(
              "Help & Support", 
              `Contact us at princekumar94666@gmail.com\n\nWe're here to help you with any questions or issues.`,
              [
                {
                  text: "OK",
                  style: "default",
                },
              ]
            )}
          />
          <SettingsItem
            icon={<User size={20} color={theme.colors.primary} />}
            title="About"
            subtitle="App version and information"
            onPress={() => showAlert(
              "About", 
              "Meetup v1.0.0\nMade with Prince Kumar , Rakesh Kumar and Ashish Kumar\n\nA social media app built with React Native and Expo.",
              [
                {
                  text: "OK",
                  style: "default",
                },
              ]
            )}
          />
        </SettingsSection>

        {/* Logout Section */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Logout size={20} color={theme.colors.rose} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

export default Settings;

const getStyles = (theme) => StyleSheet.create({
  container: {
    paddingHorizontal: wp(4),
    paddingBottom: hp(4),
  },
  section: {
    marginBottom: hp(3),
  },
  sectionTitle: {
    fontSize: hp(2.2),
    fontWeight: "600",
    color: theme.colors.textDark,
    marginBottom: hp(1),
    marginLeft: wp(2),
  },
  sectionContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    paddingVertical: hp(1),
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.textLight,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.border,
  },
  settingsItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingsItemRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.darkLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: wp(3),
  },
  textContainer: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: hp(2),
    fontWeight: "500",
    color: theme.colors.textDark,
  },
  settingsSubtitle: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    marginTop: hp(0.3),
  },
  logoutSection: {
    marginTop: hp(2),
    paddingHorizontal: wp(2),
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fee2e2",
    paddingVertical: hp(2),
    paddingHorizontal: wp(4),
    borderRadius: theme.radius.xl,
    gap: wp(2),
  },
  logoutText: {
    fontSize: hp(2),
    fontWeight: "500",
    color: theme.colors.rose,
  },
});
