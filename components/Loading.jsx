 import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { theme } from '../constants/theme'
 
 const Loading = ({size="large", color=theme.colors.primary}) => {
   return (
     <View 
        style={{justifyContent:'center',alignItems:'center'}}
        accessible={true}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading"
     >
       <ActivityIndicator size={size} color={color}/>
     </View>
   )
 }
 
 export default Loading
 
 const styles = StyleSheet.create({})