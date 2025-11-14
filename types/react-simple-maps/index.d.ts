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

  export interface ZoomPanPosition {
    coordinates: [number, number];
    zoom: number;
  }

  export interface ZoomableGroupProps extends SVGProps<SVGGElement> {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    translateExtent?: [[number, number], [number, number]];
    filterZoomEvent?: (event: WheelEvent) => boolean;
    onMoveStart?: (position: ZoomPanPosition) => void;
    onMove?: (position: ZoomPanPosition) => void;
    onMoveEnd?: (position: ZoomPanPosition) => void;
  }

  export const ZoomableGroup: FC<ZoomableGroupProps>;
}
