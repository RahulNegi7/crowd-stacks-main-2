import {
  Clarinet,
  Tx,
  Chain,
  Account,
  types
} from 'https://deno.land/x/clarinet@v1.0.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const contractName = 'crowdfunding';

Clarinet.test({
  name: "Create multiple campaigns and verify campaign count",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    // Get current block height
    let block = chain.mineBlock([]);
    const currentHeight = block.height;

    // Initial campaign count should be 0
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'get-campaign-count', [], deployer.address)
    ]);
    assertEquals(block.receipts[0].result.expectOk(), types.uint(0));

    // Create first campaign
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'create-campaign', [
        types.uint(1000000000),
        types.uint(currentHeight + 100),
        types.ascii("First Campaign")
      ], deployer.address)
    ]);
    let campaignId1 = block.receipts[0].result.expectOk();
    assertEquals(campaignId1, types.uint(0));

    // Create second campaign
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'create-campaign', [
        types.uint(500000000),
        types.uint(currentHeight + 200),
        types.ascii("Second Campaign")
      ], wallet1.address)
    ]);
    let campaignId2 = block.receipts[0].result.expectOk();
    assertEquals(campaignId2, types.uint(1));

    // Verify counts
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'get-campaign-count', [], deployer.address)
    ]);
    assertEquals(block.receipts[0].result.expectOk(), types.uint(2));

    block = chain.mineBlock([
      Tx.contractCall(contractName, 'get-active-campaigns', [], deployer.address)
    ]);
    assertEquals(block.receipts[0].result.expectOk(), types.uint(2));
  },
});

Clarinet.test({
  name: "Multi-Campaign: Contribute to specific campaigns",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;

    let block = chain.mineBlock([]);
    const currentHeight = block.height;

    // Create two campaigns
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'create-campaign', [
        types.uint(1000000000),
        types.uint(currentHeight + 100),
        types.ascii("Campaign A")
      ], deployer.address),
      Tx.contractCall(contractName, 'create-campaign', [
        types.uint(500000000),
        types.uint(currentHeight + 150),
        types.ascii("Campaign B")
      ], wallet1.address)
    ]);
    block.receipts[0].result.expectOk();
    block.receipts[1].result.expectOk();

    // Contribute to campaign 0
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'contribute', [
        types.uint(0),
        types.uint(100000000)
      ], wallet1.address)
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    // Contribute to campaign 1
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'contribute', [
        types.uint(1),
        types.uint(200000000)
      ], wallet2.address)
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    // Check campaign 0 details
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'get-campaign', [types.uint(0)], deployer.address)
    ]);
    let campaignData = block.receipts[0].result.expectSome().expectTuple();
    assertEquals(campaignData['total'], types.uint(100000000));
    assertEquals(campaignData['goal'], types.uint(1000000000));
    assertEquals(campaignData['active'], types.bool(true));

    // Check global totals
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'get-total-stx', [], deployer.address)
    ]);
    assertEquals(block.receipts[0].result.expectOk(), types.uint(300000000));

    // Check contributor count (2 unique)
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'get-total-contributors', [], deployer.address)
    ]);
    assertEquals(block.receipts[0].result.expectOk(), types.uint(2));
  },
});

Clarinet.test({
  name: "Contributor count doesn't double-increment",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    let block = chain.mineBlock([]);
    const currentHeight = block.height;

    // Create campaign
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'create-campaign', [
        types.uint(1000000000),
        types.uint(currentHeight + 100),
        types.ascii("Test Campaign")
      ], deployer.address)
    ]);
    block.receipts[0].result.expectOk();

    // First contribution
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'contribute', [
        types.uint(0),
        types.uint(100000000)
      ], wallet1.address)
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    // Second contribution from same wallet
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'contribute', [
        types.uint(0),
        types.uint(50000000)
      ], wallet1.address)
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    // Contributor count should still be 1
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'get-total-contributors', [], deployer.address)
    ]);
    assertEquals(block.receipts[0].result.expectOk(), types.uint(1));

    // Total STX should be 150
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'get-total-stx', [], deployer.address)
    ]);
    assertEquals(block.receipts[0].result.expectOk(), types.uint(150000000));
  },
});

Clarinet.test({
  name: "Close campaign reduces active count",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    let block = chain.mineBlock([]);
    const currentHeight = block.height;

    // Create two campaigns
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'create-campaign', [
        types.uint(1000000000),
        types.uint(currentHeight + 100),
        types.ascii("Campaign 1")
      ], deployer.address),
      Tx.contractCall(contractName, 'create-campaign', [
        types.uint(500000000),
        types.uint(currentHeight + 200),
        types.ascii("Campaign 2")
      ], wallet1.address)
    ]);
    block.receipts[0].result.expectOk();
    block.receipts[1].result.expectOk();

    // Check active = 2
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'get-active-campaigns', [], deployer.address)
    ]);
    assertEquals(block.receipts[0].result.expectOk(), types.uint(2));

    // Close campaign 0
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'close-campaign', [types.uint(0)], deployer.address)
    ]);
    block.receipts[0].result.expectOk();

    // Active should now be 1
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'get-active-campaigns', [], deployer.address)
    ]);
    assertEquals(block.receipts[0].result.expectOk(), types.uint(1));

    // Verify inactive
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'get-campaign', [types.uint(0)], deployer.address)
    ]);
    let campaignData = block.receipts[0].result.expectSome().expectTuple();
    assertEquals(campaignData['active'], types.bool(false));
  },
});

Clarinet.test({
  name: "Only campaign owner can close campaign",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    let block = chain.mineBlock([]);
    const currentHeight = block.height;

    // Create campaign
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'create-campaign', [
        types.uint(1000000000),
        types.uint(currentHeight + 100),
        types.ascii("Test Campaign")
      ], deployer.address)
    ]);
    block.receipts[0].result.expectOk();

    // Try non-owner close
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'close-campaign', [types.uint(0)], wallet1.address)
    ]);
    block.receipts[0].result.expectErr(types.uint(103));

    // Owner closes
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'close-campaign', [types.uint(0)], deployer.address)
    ]);
    block.receipts[0].result.expectOk();
  },
});

Clarinet.test({
  name: "Cannot contribute to inactive campaign",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    let block = chain.mineBlock([]);
    const currentHeight = block.height;

    // Create campaign
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'create-campaign', [
        types.uint(1000000000),
        types.uint(currentHeight + 100),
        types.ascii("Test Campaign")
      ], deployer.address)
    ]);
    block.receipts[0].result.expectOk();

    // Close it
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'close-campaign', [types.uint(0)], deployer.address)
    ]);
    block.receipts[0].result.expectOk();

    // Try contribution
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'contribute', [
        types.uint(0),
        types.uint(100000000)
      ], wallet1.address)
    ]);
    block.receipts[0].result.expectErr(types.uint(101));
  },
});

Clarinet.test({
  name: "Deadline and goal validation",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;

    let block = chain.mineBlock([]);
    const currentHeight = block.height;

    // Past deadline
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'create-campaign', [
        types.uint(1000000000),
        types.uint(currentHeight - 1),
        types.ascii("Invalid")
      ], deployer.address)
    ]);
    block.receipts[0].result.expectErr(types.uint(105));

    // Zero goal
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'create-campaign', [
        types.uint(0),
        types.uint(currentHeight + 100),
        types.ascii("Invalid")
      ], deployer.address)
    ]);
    block.receipts[0].result.expectErr(types.uint(104));
  },
});

Clarinet.test({
  name: "Zero amount contribution rejected",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    let block = chain.mineBlock([]);
    const currentHeight = block.height;

    // Create campaign
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'create-campaign', [
        types.uint(1000000000),
        types.uint(currentHeight + 100),
        types.ascii("Test Campaign")
      ], deployer.address)
    ]);
    block.receipts[0].result.expectOk();

    // Zero contribution
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'contribute', [
        types.uint(0),
        types.uint(0)
      ], wallet1.address)
    ]);
    block.receipts[0].result.expectErr(types.uint(106));
  },
});

Clarinet.test({
  name: "Get campaigns summary returns correct totals",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    let block = chain.mineBlock([]);
    const currentHeight = block.height;

    // Create campaigns
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'create-campaign', [
        types.uint(1000000000),
        types.uint(currentHeight + 100),
        types.ascii("Campaign 1")
      ], deployer.address),
      Tx.contractCall(contractName, 'create-campaign', [
        types.uint(500000000),
        types.uint(currentHeight + 200),
        types.ascii("Campaign 2")
      ], wallet1.address)
    ]);
    block.receipts[0].result.expectOk();
    block.receipts[1].result.expectOk();

    // Contribute
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'contribute', [
        types.uint(0),
        types.uint(100000000)
      ], wallet1.address),
      Tx.contractCall(contractName, 'contribute', [
        types.uint(1),
        types.uint(200000000)
      ], deployer.address)
    ]);

    // Get summary
    block = chain.mineBlock([
      Tx.contractCall(contractName, 'get-campaigns-summary', [], deployer.address)
    ]);
    let summary = block.receipts[0].result.expectOk().expectTuple();
    assertEquals(summary['total_camps'], types.uint(2));
    assertEquals(summary['active_camps'], types.uint(2));
    assertEquals(summary['total_stx'], types.uint(300000000));
    assertEquals(summary['total_contributors'], types.uint(2));
  },
});
