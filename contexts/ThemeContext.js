import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [loading, setLoading] = useState(true);

    // Load theme preference from storage on app start
    useEffect(() => {
        loadThemePreference();
    }, []);

    const loadThemePreference = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem('darkMode');
            if (savedTheme !== null) {
                setIsDarkMode(JSON.parse(savedTheme));
            }
        } catch (error) {
            console.error('Error loading theme preference:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleDarkMode = async () => {
        try {
            const newTheme = !isDarkMode;
            setIsDarkMode(newTheme);
            await AsyncStorage.setItem('darkMode', JSON.stringify(newTheme));
        } catch (error) {
            console.error('Error saving theme preference:', error);
        }
    };

    const value = {
        isDarkMode,
        toggleDarkMode,
        loading
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
