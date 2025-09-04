import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const RenderCounter = ({ name }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(prev => prev + 1);
  });

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {name} renders: {count}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffeb3b',
    padding: 4,
    margin: 2,
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default RenderCounter;
