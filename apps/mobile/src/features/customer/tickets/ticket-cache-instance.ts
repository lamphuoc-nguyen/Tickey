import AsyncStorage from '@react-native-async-storage/async-storage';
import { TicketCache } from './ticket-cache';
export const ticketCache = new TicketCache(AsyncStorage);
