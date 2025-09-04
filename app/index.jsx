import { useRouter } from 'expo-router';
import { View } from 'react-native';
import Loading from '../components/Loading';

const index = () => {

    const router = useRouter(); 
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Loading />
    </View>
  )
}

export default index

// const styles = StyleSheet.create({})