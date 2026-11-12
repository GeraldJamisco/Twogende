/**
 * The icons this app actually uses, imported one file at a time.
 *
 * `lucide-react-native` ships 3,514 icon modules behind a single barrel
 * export. Metro does not tree-shake in development, so `import { Check } from
 * "lucide-react-native"` makes it resolve, transform and serialise all 3,514
 * on every cold start no matter that we want one of them. That was roughly
 * two minutes of staring at a splash screen before the first render.
 *
 * Deep-importing through the package's own `./icons/*` subpath costs one
 * module per icon. Same reasoning as src/fonts.ts, and the same fix.
 *
 * Adding an icon: add a line here, then import it from this file rather than
 * from the package. Importing from "lucide-react-native" directly anywhere
 * puts the whole barrel back in the graph and undoes this.
 */

export { default as ArrowLeft } from "lucide-react-native/icons/arrow-left";
export { default as Calendar } from "lucide-react-native/icons/calendar";
export { default as CalendarDays } from "lucide-react-native/icons/calendar-days";
export { default as Camera } from "lucide-react-native/icons/camera";
export { default as Car } from "lucide-react-native/icons/car";
export { default as Check } from "lucide-react-native/icons/check";
export { default as ChevronLeft } from "lucide-react-native/icons/chevron-left";
export { default as ChevronRight } from "lucide-react-native/icons/chevron-right";
export { default as ChevronUp } from "lucide-react-native/icons/chevron-up";
export { default as Clock } from "lucide-react-native/icons/clock";
export { default as House } from "lucide-react-native/icons/house";
export { default as ImagePlus } from "lucide-react-native/icons/image-plus";
export { default as Info } from "lucide-react-native/icons/info";
export { default as Languages } from "lucide-react-native/icons/languages";
export { default as Link2 } from "lucide-react-native/icons/link-2";
export { default as LocateFixed } from "lucide-react-native/icons/locate-fixed";
export { default as Lock } from "lucide-react-native/icons/lock";
export { default as MapPin } from "lucide-react-native/icons/map-pin";
export { default as MessageCircle } from "lucide-react-native/icons/message-circle";
export { default as Pencil } from "lucide-react-native/icons/pencil";
export { default as Phone } from "lucide-react-native/icons/phone";
export { default as Route } from "lucide-react-native/icons/route";
export { default as Search } from "lucide-react-native/icons/search";
export { default as ShieldAlert } from "lucide-react-native/icons/shield-alert";
export { default as ShieldCheck } from "lucide-react-native/icons/shield-check";
export { default as Smartphone } from "lucide-react-native/icons/smartphone";
export { default as Sparkles } from "lucide-react-native/icons/sparkles";
export { default as Star } from "lucide-react-native/icons/star";
export { default as TriangleAlert } from "lucide-react-native/icons/triangle-alert";
export { default as User } from "lucide-react-native/icons/user";
export { default as X } from "lucide-react-native/icons/x";
export { default as Settings } from "lucide-react-native/icons/settings";
export { default as Trash2 } from "lucide-react-native/icons/trash-2";
