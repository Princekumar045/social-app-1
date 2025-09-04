import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { getTheme } from "../constants/theme";
import { useTheme } from "../contexts/ThemeContext";
import { hp } from "../helpers/common";
import BackButton from "./BackButton";

const Header = ({ title, showBackButton = true, mb = 10 }) => {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const theme = getTheme(isDarkMode);
  const styles = getStyles(theme);
  
  return (
    <View style={[styles.container, { marginBottom: mb }]}>
      {
      showBackButton && (
            <View style={styles.backButton}>
                <BackButton router={router} />
            </View>
        )
      }
      <Text style={styles.title}>{title || ""}</Text>
    </View>
  );
};

export default Header;

const getStyles = (theme) => StyleSheet.create({
    container: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 5,
        gap: 10,
        position: "relative",
    },
    title: {
        fontSize: hp(2.7),
        fontWeight: theme.fonts.semibold,
        color: theme.colors.textDark,
        textAlign: "center",
    },
    backButton: {
        position: "absolute",
        left: 0,
    },
});
