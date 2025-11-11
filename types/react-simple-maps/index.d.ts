import type { CSSProperties, FC, ReactNode, SVGProps } from "react";

declare module "react-simple-maps" {
  export interface ComposableMapProps extends SVGProps<SVGSVGElement> {
    projection?: string | ((...args: any[]) => any);
    projectionConfig?: Record<string, unknown>;
    children?: ReactNode;
  }

  export const ComposableMap: FC<ComposableMapProps>;

  export interface GeographiesRenderProps {
    geographies: Array<{
      rsmKey: string;
      id?: string | number;
      properties?: Record<string, unknown>;
      [key: string]: unknown;
    }>;
  }

  export interface GeographiesProps {
    geography: string | Record<string, unknown>;
    children?: (props: GeographiesRenderProps) => ReactNode;
  }

  export const Geographies: FC<GeographiesProps>;

  export interface GeographyStyle {
    default?: CSSProperties;
    hover?: CSSProperties;
    pressed?: CSSProperties;
  }

  export interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: Record<string, unknown>;
    style?: GeographyStyle;
  }

  export const Geography: FC<GeographyProps>;

  export interface MarkerProps extends SVGProps<SVGGElement> {
    coordinates: [number, number];
    children?: ReactNode;
  }

  export const Marker: FC<MarkerProps>;
}
