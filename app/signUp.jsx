 import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import Icon from '../assets/icons'
import BackButton from '../components/BackButton'
import Button from '../components/Button'
import Input from '../components/Input'
import ScreenWrapper from '../components/ScreenWrapper'
import { theme } from '../constants/theme'
import { hp, wp } from '../helpers/common'
import { supabase } from '../lib/supabase'
import { checkUsernameAvailability, validateUsername } from '../services/userServices'

const signUp = () => {
    const router = useRouter();
    const emailRef = useRef("");
    const nameRef = useRef("");
    const usernameRef = useRef("");
    const passwordRef = useRef("");
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [checkingUsername, setCheckingUsername] = useState(false);

    // Validation functions
    const validateName = (name) => {
      if (!name) {
        return "Name is required";
      }
      if (name.length < 2) {
        return "Name must be at least 2 characters long";
      }
      if (name.length > 50) {
        return "Name must be less than 50 characters";
      }
      if (!/^[a-zA-Z\s]+$/.test(name)) {
        return "Name can only contain letters and spaces";
      }
      return "";
    };

    const validateEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email) {
        return "Email is required";
      }
      if (!emailRegex.test(email)) {
        return "Please enter a valid email address";
      }
      return "";
    };

    const validatePassword = (password) => {
      if (!password) {
        return "Password is required";
      }
      if (password.length < 8) {
        return "Password must be at least 8 characters long";
      }
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        return "Password must contain at least one uppercase letter, one lowercase letter, and one number";
      }
      return "";
    };

    const validateUsernameField = async (username) => {
      // First check format
      const formatError = validateUsername(username);
      if (formatError) {
        return formatError;
      }
      
      // Then check availability
      setCheckingUsername(true);
      const availabilityResult = await checkUsernameAvailability(username);
      setCheckingUsername(false);
      
      if (!availabilityResult.success) {
        return availabilityResult.msg;
      }
      
      if (!availabilityResult.available) {
        return "This username is already taken";
      }
      
      return "";
    };

    const validateField = async (field, value) => {
      let error = "";
      if (field === 'name') {
        error = validateName(value);
      } else if (field === 'email') {
        error = validateEmail(value);
      } else if (field === 'username') {
        error = await validateUsernameField(value);
      } else if (field === 'password') {
        error = validatePassword(value);
      }
      
      setErrors(prev => ({
        ...prev,
        [field]: error
      }));
      
      return error === "";
    };

    const handleFieldChange = (field, value) => {
      // Ensure value is a string
      const stringValue = value || '';
      
      if (field === 'name') {
        nameRef.current = stringValue;
      } else if (field === 'email') {
        emailRef.current = stringValue;
      } else if (field === 'username') {
        usernameRef.current = stringValue;
      } else if (field === 'password') {
        passwordRef.current = stringValue;
      }
      
      // Validate field if it has been touched
      if (touched[field]) {
        validateField(field, stringValue);
      }
    };

    const handleFieldBlur = (field) => {
      setTouched(prev => ({
        ...prev,
        [field]: true
      }));
      
      let value = '';
      if (field === 'name') {
        value = nameRef.current || '';
      } else if (field === 'email') {
        value = emailRef.current || '';
      } else if (field === 'username') {
        value = usernameRef.current || '';
      } else if (field === 'password') {
        value = passwordRef.current || '';
      }
      
      validateField(field, value);
    };

  const onSubmit = async () => {
    // Validate all fields first
    setTouched({
      name: true,
      email: true,
      username: true,
      password: true
    });

    // Check if all fields are filled
    if (!nameRef.current || !emailRef.current || !usernameRef.current || !passwordRef.current) { 
      Alert.alert('Sign up', 'Please fill all the fields');
      return;
    }
    
    let name = nameRef.current.trim();
    let email = emailRef.current.trim();
    let username = usernameRef.current.trim();
    let password = passwordRef.current.trim();

    // Validate all fields
    const nameValid = await validateField('name', name);
    const emailValid = await validateField('email', email);
    const usernameValid = await validateField('username', username);
    const passwordValid = await validateField('password', password);

    if (!nameValid || !emailValid || !usernameValid || !passwordValid) {
      Alert.alert('Sign up', 'Please fix the errors in the form');
      return;
    }

    setLoading(true);

    try {
      // Sign up the user with name and username metadata
      const {data, error} = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            username
          }
        } 
      });
      
      // console.log('Response data:', data);
      // console.log('Error:', error);
      
      if(error) {
        setLoading(false);
        // Handle specific error types
        if (error.message.includes('Database error')) {
          Alert.alert('Database Setup Required', 'Please run the database setup script first. Check DATABASE_SETUP.md for instructions.');
        } else if (error.message.includes('User already registered')) {
          Alert.alert('Sign up', 'This email is already registered. Please try logging in instead.');
        } else {
          Alert.alert('Sign up', error.message);
        }
        return;
      }
      
      if (data.user) {
        setLoading(false);
        Alert.alert('Success', 'Account created successfully! You can now log in.');
        router.push('/login');
      }
    } catch (err) {
      setLoading(false);
      console.error('Signup error:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  return (
    <ScreenWrapper bg="white">
      <StatusBar style="dark"/>
      <View style={styles.container}>
        <BackButton router={router} />
        
        <View>
          <Text style={styles.welcomeText}>Let's</Text>
          <Text style={styles.welcomeText}>Get Started</Text>
        </View>

        <View style={styles.form}>
          <Text style={{fontSize: hp(1.5), color: theme.colors.text}}>Please fill in the details to create an account</Text>

          <View>
            <Input
             icon={<Icon name="user" size={26} strokeWidth={1.6}/>}
             placeholder="Enter your name"
             onChangeText={value => handleFieldChange('name', value)}
             onBlur={() => handleFieldBlur('name')}
             containerStyles={errors.name && touched.name ? styles.errorInput : {}}
             />
             {errors.name && touched.name ? (
               <Text style={styles.errorText}>{errors.name}</Text>
             ) : null}
          </View>

          <View>
            <Input
             icon={<Icon name="user" size={26} strokeWidth={1.6}/>}
             placeholder="Enter your username"
             onChangeText={value => handleFieldChange('username', value)}
             onBlur={() => handleFieldBlur('username')}
             containerStyles={errors.username && touched.username ? styles.errorInput : {}}
             />
             {checkingUsername && (
               <Text style={styles.checkingText}>Checking username availability...</Text>
             )}
             {errors.username && touched.username ? (
               <Text style={styles.errorText}>{errors.username}</Text>
             ) : null}
          </View>

          <View>
            <Input
             icon={<Icon name="mail" size={26} strokeWidth={1.6}/>}
             placeholder="Enter your email"
             onChangeText={value => handleFieldChange('email', value)}
             onBlur={() => handleFieldBlur('email')}
             containerStyles={errors.email && touched.email ? styles.errorInput : {}}
             />
             {errors.email && touched.email ? (
               <Text style={styles.errorText}>{errors.email}</Text>
             ) : null}
          </View>

          <View>
            <Input
             icon={<Icon name="lock" size={26} strokeWidth={1.6}/>}
             placeholder="Enter your password"
             secureTextEntry
             onChangeText={value => handleFieldChange('password', value)}
             onBlur={() => handleFieldBlur('password')}
             containerStyles={errors.password && touched.password ? styles.errorInput : {}}
             />
             {errors.password && touched.password ? (
               <Text style={styles.errorText}>{errors.password}</Text>
             ) : null}
          </View>  

           <Button title={'Sign Up'} loading={loading} onPress={onSubmit} />
      </View>

      {/* footer */}
        <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Pressable onPress={() => router.push('/login')}>   
                <Text style={[styles.footerText,{color: theme.colors.primaryDark, fontWeight: theme.fonts.semibold}]}>Login</Text>
            </Pressable> 
        </View>
      </View>
     </ScreenWrapper>
   )
 }
 
 export default signUp

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 45,
    paddingHorizontal: wp(5),
  },
  welcomeText: {
    fontSize: hp(4),
    fontWeight: theme.fonts.bold,
    color: theme.colors.text,
  },
  form: {
    gap: 25,
  },
  forgotPassword: {
  textAlign: 'right',
  fontWeight: theme.fonts.semibold,
  color: theme.colors.text,
},
footer: {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 5,
},
footerText: {
  textAlign: 'center',
  color: theme.colors.text,
  fontSize: hp(2),
},
errorInput: {
  borderColor: theme.colors.rose,
  borderWidth: 1,
},
errorText: {
  color: theme.colors.rose,
  fontSize: hp(1.4),
  marginTop: 5,
  marginLeft: 5,
},
checkingText: {
  color: theme.colors.primary,
  fontSize: hp(1.4),
  marginTop: 5,
  marginLeft: 5,
  fontStyle: 'italic',
}
});