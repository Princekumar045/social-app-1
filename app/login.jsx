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

 
 const login = () => {
    const router = useRouter ();
    const emailRef = useRef("");
    const passwordRef = useRef("");
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});

    // Validation functions
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
      if (password.length < 6) {
        return "Password must be at least 6 characters long";
      }
      return "";
    };

    const validateField = (field, value) => {
      let error = "";
      if (field === 'email') {
        error = validateEmail(value);
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
      if (field === 'email') {
        emailRef.current = value;
      } else if (field === 'password') {
        passwordRef.current = value;
      }
      
      // Validate field if it has been touched
      if (touched[field]) {
        validateField(field, value);
      }
    };

    const handleFieldBlur = (field) => {
      setTouched(prev => ({
        ...prev,
        [field]: true
      }));
      
      const value = field === 'email' ? emailRef.current : passwordRef.current;
      validateField(field, value);
    };

  const onSubmit = async () => {
    if(!emailRef.current || !passwordRef.current) {
      Alert.alert("Login", "Please fill in all fields");
      return;
    }

    let email = emailRef.current.trim();
    let password = passwordRef.current.trim();
    
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    console.log('Response data:', data);
    console.log('Error:', error);
    if (error) {
      setLoading(false);
      Alert.alert("Login Error", error.message);
      return;
    } 

    setLoading(false);
}

 
   return (
     <ScreenWrapper bg="white">
      <StatusBar style="dark"/>
      <View style={styles.container}>
        <BackButton router={router} />
        {/* welcome */}
        <View>
        <Text style={styles.welcomeText}>Hey,</Text>
        <Text style={styles.welcomeText}>Welcome Back</Text>
        </View>

        {/* form */}
        <View style={styles.form}>
          <Text style={{fontSize: hp(1.5), color: theme.colors.text}}>Please login to continue </Text>

          <View>
            <Input
             icon={<Icon name="mail" size={26} strokeWidth={1.6}/>}
             placeholder="Enter your email"
             onChangeText={value => handleFieldChange('email', value)}
             onBlur={() => handleFieldBlur('email')}
             containerStyles={errors.email && touched.email ? styles.errorInput : {}}
             />
             {errors.email && touched.email && (
               <Text style={styles.errorText}>{errors.email}</Text>
             )}
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
             {errors.password && touched.password && (
               <Text style={styles.errorText}>{errors.password}</Text>
             )}
          </View>  

           <Text style={styles.forgotPassword}>Forgot Password?</Text>
           <Button title={'Login'} loading={loading} onPress={onSubmit} />
      </View>

      {/* footer */}
        <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Pressable onPress={() => router.push('/signUp')  }>
                <Text style={[styles.footerText,{color: theme.colors.primaryDark, fontWeight: theme.fonts.semibold}]} >Sign Up</Text>
            </Pressable> 
            </View>

      </View>
     </ScreenWrapper>
   )
 }
 
 export default login

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
  fontSize: hp(2.0),
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
}
});