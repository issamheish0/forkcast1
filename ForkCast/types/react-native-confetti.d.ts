declare module 'react-native-confetti' {
  import { Component } from 'react';
  import { ViewStyle } from 'react-native';

  interface ConfettiViewProps {
    style?: ViewStyle;
    ref?: any;
    [key: string]: any;
  }

  export default class ConfettiView extends Component<ConfettiViewProps> {
    startConfetti(): void;
    stopConfetti(): void;
  }
}
