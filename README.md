# Social App 📱

A modern, cross-platform social media application built with React Native and Expo, featuring real-time messaging, post sharing, and social interactions.

## 🌟 Features

### Core Features
- **User Authentication** - Secure login and registration with Supabase
- **Profile Management** - Create and edit user profiles with avatars
- **Post Creation & Sharing** - Share text, images, and video content
- **Real-time Messaging** - Chat with other users instantly
- **Social Interactions** - Like, comment, and share posts
- **Follow System** - Follow/unfollow users and see their updates
- **Search Functionality** - Find users and content easily
- **Notifications** - Stay updated with real-time notifications
- **Video Posts** - Share and view video content
- **Rich Text Editor** - Create posts with rich formatting

### Technical Features
- **Cross-platform** - Runs on iOS, Android, and Web
- **Real-time Updates** - Live notifications and messaging
- **Offline Support** - Works with limited connectivity
- **Responsive Design** - Optimized for all screen sizes
- **Dark/Light Theme** - Automatic theme switching
- **Image/Video Handling** - Upload and process media files

## 🛠️ Tech Stack

### Frontend
- **React Native** (0.79.5) - Cross-platform mobile development
- **Expo** (SDK 53) - Development platform and tooling
- **Expo Router** - File-based navigation system
- **React** (19.0.0) - UI library
- **TypeScript** - Type safety and better development experience

### Backend & Database
- **Supabase** - Backend-as-a-Service (Authentication, Database, Storage)
- **PostgreSQL** - Relational database via Supabase
- **Real-time Subscriptions** - Live data updates

### Key Libraries
- **@supabase/supabase-js** - Supabase JavaScript client
- **expo-image-picker** - Image and video selection
- **expo-av** - Audio and video playback
- **react-native-pell-rich-editor** - Rich text editing
- **react-native-render-html** - HTML content rendering
- **moment** - Date and time manipulation
- **expo-notifications** - Push notifications

## 📱 Platform Support

- **iOS** - Native iOS app
- **Android** - Native Android app (APK/AAB builds)
- **Web** - Progressive Web App (PWA)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or later)
- npm or yarn
- Expo CLI
- EAS CLI (for building)
- iOS Simulator (for iOS development)
- Android Studio/Emulator (for Android development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Princekumar045/social-app-1.git
   cd social-app-1
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `constants/index.js` file with your Supabase credentials:
   ```javascript
   export const supabaseUrl = 'YOUR_SUPABASE_URL'
   export const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

### Development Commands

```bash
# Start development server
npm start

# Run on specific platforms
npm run android    # Android emulator/device
npm run ios        # iOS simulator/device
npm run web        # Web browser

# Build for production
eas build --platform android    # Android APK/AAB
eas build --platform ios        # iOS IPA
eas build --platform all        # Both platforms

# Lint code
npm run lint

# Reset project (development utility)
npm run reset-project
```

## 📂 Project Structure

```
social-app/
├── app/                    # Main application screens
│   ├── main/              # Core app screens
│   │   ├── home.jsx       # Home feed
│   │   ├── chat.jsx       # Chat/messaging
│   │   ├── profile.jsx    # User profile
│   │   ├── newPost.jsx    # Create new post
│   │   ├── search.jsx     # Search functionality
│   │   └── ...
│   ├── index.jsx          # Landing page
│   ├── login.jsx          # Authentication
│   ├── signUp.jsx         # User registration
│   └── _layout.jsx        # Root layout
├── components/            # Reusable UI components
│   ├── Avatar.jsx         # User avatar component
│   ├── PostCard.jsx       # Post display component
│   ├── Header.jsx         # Navigation header
│   └── ...
├── services/              # API and business logic
│   ├── userServices.js    # User management
│   ├── postService.jsx    # Post operations
│   ├── messageService.js  # Messaging functionality
│   └── ...
├── contexts/              # React Context providers
│   ├── AuthContext.js     # Authentication state
│   ├── ThemeContext.js    # Theme management
│   └── ...
├── assets/                # Static assets
│   ├── images/           # App icons and images
│   └── fonts/            # Custom fonts
├── constants/             # App constants and config
├── lib/                   # Third-party integrations
│   └── supabase.js       # Supabase client
└── utils/                 # Utility functions
```

## 🎨 Screenshots

[Add screenshots of your app here showing key features like home feed, profile, chat, etc.]

## 🚀 Deployment

### Android
1. **APK Build** (for direct installation)
   ```bash
   eas build --platform android
   ```

2. **AAB Build** (for Google Play Store)
   ```bash
   # Update eas.json to use "aab" buildType
   eas build --platform android
   ```

### iOS
```bash
eas build --platform ios
```

### Web
```bash
npx expo export -p web
```

## 📋 Environment Setup

### Required Environment Variables
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Supabase Setup
1. Create a new Supabase project
2. Set up authentication providers
3. Create database tables for users, posts, messages, etc.
4. Configure storage buckets for media files
5. Set up real-time subscriptions

## 🔧 Configuration

### EAS Build Configuration
The project uses EAS Build for creating production builds. Configuration is in `eas.json`:

```json
{
  "build": {
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "apk"  // or "aab" for Play Store
      }
    }
  }
}
```

### App Configuration
Main app settings are in `app.json`:
- App name and slug
- Platform-specific settings
- Splash screen configuration
- Icon and adaptive icon setup

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Prince Kumar**
- GitHub: [@Princekumar045](https://github.com/Princekumar045)
- Project: [social-app-1](https://github.com/Princekumar045/social-app-1)

## 🙏 Acknowledgments

- Built with [Expo](https://expo.dev/)
- Backend powered by [Supabase](https://supabase.com/)
- UI components inspired by modern social media platforms

## 📞 Support

If you have any questions or need help with setup, please open an issue or contact the maintainer.

---

**Made with ❤️ using React Native and Expo**
