const fs = require('fs');
const files = [
  'screens/UserDetailScreen.tsx', 'screens/TripsScreen.tsx', 'screens/PlaceDiscoveryScreen.tsx', 
  'screens/DiscoverScreen.tsx', 'screens/ChecklistScreen.tsx', 'components/CreatePostModal.tsx'
];
files.forEach(f => {
  const path = 'c:/Users/Asus/Downloads/travelholic (1)/travelholic/frontend/src/' + f;
  let code = fs.readFileSync(path, 'utf8');
  if (!code.includes('Pressable') || !code.match(/import\s*\{[^}]*Pressable[^}]*\}\s*from\s*['"]react-native['"]/)) {
    code = code.replace(/import\s*\{([\s\S]*?)\}\s*from\s*['"]react-native['"]/, 'import { Pressable, $1 } from \\\'react-native\\\'');
    fs.writeFileSync(path, code);
  }
});
