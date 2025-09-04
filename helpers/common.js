import { Dimensions } from "react-native";

// Function to get height percentage
export const hp = (percentage) => {
  const { height: deviceHeight } = Dimensions.get("window");
  return (percentage * deviceHeight) / 100;
};

// Function to get width percentage
export const wp = (percentage) => {
  const { width: deviceWidth } = Dimensions.get("window");
  return (percentage * deviceWidth) / 100;
};


export const stripHtmlTags =(html) =>{
  return html.replace(/<[^>]*>/gm, '');  
}

// export { hp, wp };