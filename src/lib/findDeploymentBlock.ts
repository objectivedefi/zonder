import type { Address, PublicClient } from 'viem';

/**
 * Find the deployment block of a contract using binary search
 * @param client - Viem public client
 * @param contractAddress - The contract address to find deployment for
 * @returns The block number where the contract was deployed, or null if not found
 */
export async function findDeploymentBlock(
  client: PublicClient,
  contractAddress: Address,
): Promise<bigint | null> {
  try {
    // First check if this address has any code
    const code = await client.getCode({ address: contractAddress });
    if (!code || code === '0x') {
      console.log(`Address ${contractAddress} has no code`);
      return null;
    }

    // Get the latest block number to set our upper bound
    const latestBlock = await client.getBlockNumber();

    let low = 0n;
    let high = latestBlock;
    let deploymentBlock: bigint | null = null;

    // Binary search to find the deployment block
    while (low <= high) {
      const mid = (low + high) / 2n;

      try {
        const codeAtBlock = await client.getCode({
          address: contractAddress,
          blockNumber: mid,
        });

        if (codeAtBlock && codeAtBlock !== '0x') {
          // Contract exists at this block, so deployment was at or before this block
          deploymentBlock = mid;
          high = mid - 1n;
        } else {
          // Contract doesn't exist at this block, so deployment was after this block
          low = mid + 1n;
        }
      } catch (error) {
        // If we get an error (like block not found), adjust our search
        high = mid - 1n;
      }
    }

    return deploymentBlock;
  } catch (error) {
    console.error(`Error finding deployment block for ${contractAddress}:`, error);
    return null;
  }
}
