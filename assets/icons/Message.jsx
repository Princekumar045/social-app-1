import Svg, { Path } from "react-native-svg"
import { theme } from "../../constants/theme"

const Message = (props) => {
  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      color={theme.colors.textLight}
      fill="none"
      {...props}
    >
      <Path
        d="M8.5 14.5H15.5M8.5 10.5H12"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.1706 20.7905C13.8006 20.9355 13.4156 21.0255 13.0156 21.0255C6.50559 21.0255 2.97559 16.9605 2.97559 12.1205C2.97559 6.63049 6.85559 2.02549 12.0156 2.02549C17.1756 2.02549 21.0556 6.63049 21.0556 12.1205C21.0556 13.7805 20.6856 15.3405 19.9856 16.7405C19.7806 17.1105 19.7256 17.5505 19.8506 17.9605L20.8056 21.2305C20.9756 21.7705 20.4556 22.2905 19.9156 22.1205L16.6456 21.1655C16.2356 21.0405 15.7956 21.0955 15.4256 21.3005C15.0256 21.5255 14.6056 21.6905 14.1706 21.7905Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export default Message
