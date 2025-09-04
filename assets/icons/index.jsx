
import { theme } from '../../constants/theme';
import ArrowLeft from './ArrowLeft';
import Bell from './Bell';
import Call from './Call';
import Camera from './Camera';
import Comment from './Comment';
import Delete from './Delete';
import Edit from './Edit';
import Heart from './Heart';
import Home from './Home';
import Image from './Image';
import Location from './Location';
import Lock from './Lock';
import Logout from './logout';
import Mail from './Mail';
import Message from './Message';
import Plus from './Plus';
import Search from './Search';
import Send from './Send';
import Settings from './Settings';
import Share from './Share';
import Star from './Star';
import ThreeDotsCircle from './ThreeDotsCircle';
import ThreeDotsHorizontal from './ThreeDotsHorizontal';
import User from './User';
import Video from './Video';
import X from './X';

const icons = {
    home: Home,
    mail: Mail,
    lock: Lock,
    user: User,
    heart: Heart,
    plus: Plus,
    search: Search,
    location: Location,
    call: Call,
    camera: Camera,
    edit: Edit,
    arrowLeft: ArrowLeft,
    threeDotsCircle: ThreeDotsCircle,
    threeDotsHorizontal: ThreeDotsHorizontal,
    comment: Comment,
    share: Share,
    send: Send,
    settings: Settings,
    delete: Delete,
    logout: Logout,
    image: Image,
    video: Video,
    bell: Bell,
    message: Message,
    x: X,
    star: Star,
}

const Icon = ({name, ...props}) => {
    const IconComponent = icons[name];
  return (
    <IconComponent
        height={props.size || 24}
        width={props.size || 24}
        strokeWidth={props.strokeWidth || 1.9}
        color={theme.colors.textLight}
        {...props}
    />
  )
}

export default Icon;

