import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { colors } from '@/theme';

/**
 * Logo Sasana: roda gigi (produksi/pabrik) dengan daun jamu di tengahnya.
 * Dibuat dua lapis (roda gigi & daun) supaya bisa dianimasikan terpisah di splash.
 */

const TEETH = Array.from({ length: 8 }, (_, i) => i * 45);

/** Roda gigi putih (viewBox 64). `hole` = warna lubang tengah. */
export function LogoGear({ size, color = '#FFFFFF', hole = colors.primary }: { size: number; color?: string; hole?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <G>
        {TEETH.map((a) => (
          <Rect key={a} x={28} y={6} width={8} height={11} rx={2} fill={color} transform={`rotate(${a} 32 32)`} />
        ))}
        <Circle cx={32} cy={32} r={19} fill={color} />
        <Circle cx={32} cy={32} r={13.5} fill={hole} />
      </G>
    </Svg>
  );
}

/** Daun jamu (viewBox 64, pas di lubang roda gigi). */
export function LogoLeaf({ size, color = '#FFFFFF', vein = colors.primary }: { size: number; color?: string; vein?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M39.5 22.5 C40.5 33 35 41.5 25 42 C24 31.5 29.5 23.5 39.5 22.5 Z" fill={color} />
      <Path d="M26.5 40.5 L37.5 25" stroke={vein} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M31 34 L28 31.5 M33.6 30.4 L32 27.6" stroke={vein} strokeWidth={1.2} strokeLinecap="round" />
    </Svg>
  );
}

/** Logo lengkap di kotak hijau membulat (header, login). */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: size * 0.86, height: size * 0.86 }}>
        <LogoGear size={size * 0.86} />
        <View style={{ position: 'absolute', inset: 0 }}>
          <LogoLeaf size={size * 0.86} />
        </View>
      </View>
    </View>
  );
}
