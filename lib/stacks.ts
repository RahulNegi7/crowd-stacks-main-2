// Stacks blockchain utilities and contract interaction helpers
import { StacksTestnet } from '@stacks/network'; // Changed to Testnet
import { AppConfig, UserSession, openContractCall } from '@stacks/connect'; // Added imports
import { 
  callReadOnlyFunction,
  cvToJSON,
  uintCV,
  principalCV,
  AnchorMode
} from '@stacks/transactions';

// --- Wallet and Network Configuration ---
// Use StacksTestnet() for the live testnet
export const network = new StacksTestnet(); 

// Standard wallet session setup
const appConfig = new AppConfig(['store_write', 'publish_data']);
export const userSession = new UserSession({ appConfig });

// --- Contract Details ---
// Make sure this is your DEPLOYED testnet address
export const CONTRACT_ADDRESS = 'ST1RVN5QPTET1RV9BJQX35JQWJFYG8YNHQEY5QN24'; 
export const CONTRACT_NAME = 'crowdfunding';

// --- Helper Functions ---

// Helper for read-only calls (No changes needed here)
export async function callContractReadOnly(functionName: string, functionArgs: any[] = []) {
  try {
    const result = await callReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName,
      functionArgs,
      network,
      // For read-only calls, we can use any valid address as the sender
      senderAddress: CONTRACT_ADDRESS 
    });
    return cvToJSON(result);
  } catch (error) {
    console.error('Contract read call failed:', error);
    throw error;
  }
}

// Helper for state-changing calls (This is the updated part)
export async function callContract(functionName: string, functionArgs: any[]) {
  try {
    await openContractCall({
      network,
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName,
      functionArgs,
      anchorMode: AnchorMode.Any,
      onFinish: (data) => {
        console.log('Transaction signed and broadcasted!', data);
      },
      onCancel: () => {
        console.log('Transaction cancelled by user.');
      },
    });
  } catch (error) {
    console.error('Contract call failed:', error);
    throw error;
  }
}

// --- Contract-Specific Helpers (Updated to remove senderKey) ---
export const contractHelpers = {
  async getCampaignStatus() {
    return await callContractReadOnly('get-campaign-status');
  },

  async getTotal() {
    return await callContractReadOnly('get-total');
  },

  async getContribution(address: string) {
    return await callContractReadOnly('get-contribution', [principalCV(address)]);
  },

  async contribute(amount: number) { // senderKey removed
    const amountInMicroSTX = Math.floor(amount * 1000000);
    return await callContract('contribute', [uintCV(amountInMicroSTX)]);
  },

  async withdrawFunds() { // senderKey removed
    return await callContract('withdraw-funds', []);
  },

  async getRefund() { // senderKey removed
    return await callContract('get-refund', []);
  }
};