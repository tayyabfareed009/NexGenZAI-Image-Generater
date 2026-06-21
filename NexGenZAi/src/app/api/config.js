import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_PORT = 5000;
const API_PATH = '/api';

function getDevMachineHost() {
  const hostUri = Constants.expoConfig?.hostUri;

  if (hostUri) {
    return hostUri.split(':')[0];
  }

  const debuggerHost = Constants.expoGoConfig?.debuggerHost;

  if (debuggerHost) {
    return debuggerHost.split(':')[0];
  }

  return null;
}

export function getApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');

  if (configured && !configured.includes('localhost') && !configured.includes('127.0.0.1')) {
    return configured;
  }

  const devHost = getDevMachineHost();

  if (devHost) {
    return `http://${devHost}:${DEFAULT_PORT}${API_PATH}`;
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_PORT}${API_PATH}`;
  }

  return configured || `http://localhost:${DEFAULT_PORT}${API_PATH}`;
}
