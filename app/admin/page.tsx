 "use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Settings,
  Users,
  Target,
  TrendingUp,
  BarChart3,
  X,
  CheckCircle,
  AlertCircle,
  LogIn,
} from "lucide-react"
import {
  callReadOnlyFunction,
  cvToJSON,
  uintCV,
  AnchorMode
} from '@stacks/transactions'
import { PostConditionMode, FungibleConditionCode, makeContractSTXPostCondition } from '@stacks/transactions'
import { StacksTestnet } from '@stacks/network'
import { UserSession, AppConfig, showConnect, openContractCall } from '@stacks/connect'

// Contract configuration
const CONTRACT_ADDRESS = "ST1RVN5QPTET1RV9BJQX35JQWJFYG8YNHQEY5QN24" // Replace with your deployed address
const CONTRACT_NAME = "crowdfunding"
const network = new StacksTestnet()

// Wallet configuration
const appConfig = new AppConfig(["store_write", "publish_data"])
const userSession = new UserSession({ appConfig })

// TypeScript interfaces
interface Campaign {
  id: number
  title: string
  description: string
  goal: number
  total: number
  deadline: number
  owner: string
  active: boolean
  successful?: boolean
  withdrawn?: boolean
  finalized?: boolean
}

interface GlobalStats {
  totalRaised: number
  totalContributors: number
  activeCampaigns: number
  totalCampaigns: number
}

// Helper functions for parsing Clarity values
const jNum = (cv: any) => Number(cv?.value ?? 0)
const jStr = (cv: any) => String(cv?.value ?? "")
const jBool = (cv: any) => Boolean(cv?.value ?? false)

const parseCampaign = (json: any, id: number): Campaign => {
  const d = json?.value?.value ?? {}
  return {
    id,
    title: jStr(d.title) || `Campaign ${id}`,
    description: jStr(d.description) || `Campaign ${id}`,
    goal: jNum(d.goal) / 1_000_000,
    total: jNum(d.total) / 1_000_000,
    deadline: jNum(d.deadline),
    owner: d.owner?.value || '',
    active: jBool(d.active),
    successful: jBool(d.successful),
    withdrawn: jBool(d.withdrawn),
    finalized: jBool(d.finalized),
  }
}

export default function AdminPage() {
  const [user, setUser] = useState<any>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalRaised: 0,
    totalContributors: 0,
    activeCampaigns: 0,
    totalCampaigns: 0,
  })
  const [loading, setLoading] = useState(true)
  const [closingCampaign, setClosingCampaign] = useState<number | null>(null)

  // Check wallet connection on load
  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      setUser(userSession.loadUserData())
    }
    fetchAllData()
  }, [])

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchAllData, 30000)
    return () => clearInterval(interval)
  }, [])

  // Connect wallet
  const handleConnect = () => {
    showConnect({
      appDetails: {
        name: "CrowdStacks - Admin Dashboard",
        icon: window.location.origin + "/favicon.ico",
      },
      redirectTo: "/admin",
      userSession,
      onFinish: () => {
        window.location.reload()
      },
    })
  }

  // Fetch all blockchain data
  const fetchAllData = async () => {
    try {
      setLoading(true)

      // Get global stats
      const [totalSTX, totalContributors, activeCampaigns, campaignCount] = await Promise.all([
        callReadOnlyFunction({
          contractAddress: CONTRACT_ADDRESS,
          contractName: CONTRACT_NAME,
          functionName: "get-total-stx",
          functionArgs: [],
          network,
          senderAddress: CONTRACT_ADDRESS,
        }),
        callReadOnlyFunction({
          contractAddress: CONTRACT_ADDRESS,
          contractName: CONTRACT_NAME,
          functionName: "get-total-contributors",
          functionArgs: [],
          network,
          senderAddress: CONTRACT_ADDRESS,
        }),
        callReadOnlyFunction({
          contractAddress: CONTRACT_ADDRESS,
          contractName: CONTRACT_NAME,
          functionName: "get-active-campaigns",
          functionArgs: [],
          network,
          senderAddress: CONTRACT_ADDRESS,
        }),
        callReadOnlyFunction({
          contractAddress: CONTRACT_ADDRESS,
          contractName: CONTRACT_NAME,
          functionName: "get-campaign-count",
          functionArgs: [],
          network,
          senderAddress: CONTRACT_ADDRESS,
        }),
      ])

      // Update global stats
      setGlobalStats({
        totalRaised: Number(cvToJSON(totalSTX).value) / 1_000_000,
        totalContributors: Number(cvToJSON(totalContributors).value),
        activeCampaigns: Number(cvToJSON(activeCampaigns).value),
        totalCampaigns: Number(cvToJSON(campaignCount).value),
      })

      // Fetch all campaigns
      const count = Number(cvToJSON(campaignCount).value)
      const campaignPromises = []

      for (let i = 0; i < count; i++) {
        campaignPromises.push(
          callReadOnlyFunction({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: "get-campaign",
            functionArgs: [uintCV(i)],
            network,
            senderAddress: CONTRACT_ADDRESS,
          }),
        )
      }

      const campaignResults = await Promise.all(campaignPromises)
      const fetchedCampaigns: Campaign[] = campaignResults
        .map((result, index) => {
          try {
            const parsed = parseCampaign(cvToJSON(result), index)
            return parsed
          } catch (error) {
            console.warn(`Failed to parse campaign ${index}:`, error)
            return null
          }
        })
        .filter((campaign): campaign is Campaign => campaign !== null)

      setCampaigns(fetchedCampaigns)
    } catch (error) {
      console.error("Error fetching blockchain data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Add this new function inside your AdminPage component
  const waitForTransaction = async (txId: string) => {
    const maxRetries = 15;
    let retries = 0;

    return new Promise<void>((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`https://api.testnet.hiro.so/extended/v1/tx/${txId}`)
          const data = await response.json()

          if (data.tx_status === "success" || data.tx_status === "failed") {
            clearInterval(interval)
            resolve()
          } else if (retries >= maxRetries) {
            clearInterval(interval)
            reject(new Error("Transaction timed out"))
          }
          retries++
        } catch (error) {
          clearInterval(interval)
          reject(error)
        }
      }, 5000) // Check every 5 seconds
    })
  }

  const handleCloseCampaign = async (campaignId: number) => {
    if (!user) {
      alert("Please connect your wallet first")
      return
    }

    const campaign = campaigns.find((c) => c.id === campaignId)
    if (!campaign) return

    if (campaign.owner !== user.profile.stxAddress.testnet) {
      alert("Only the campaign owner can finalize this campaign")
      return
    }

    // 1. Check if the campaign was successful
    const goalReached = campaign.total >= campaign.goal

    // 2. Set the correct function name based on the result
    const functionName = goalReached ? "withdraw-funds" : "finalize-failure"

    // 3. Create a dynamic confirmation message
    const confirmationMessage = goalReached
      ? `This campaign has reached its goal. Are you sure you want to withdraw the funds and close it?`
      : `This campaign has not reached its goal. Are you sure you want to close it so contributors can get refunds?`

    // 4. Show the correct message and stop if the user cancels
    if (!confirm(confirmationMessage)) {
      return
    }

    setClosingCampaign(campaignId)

    try {
      // Build post-conditions for withdraw to prevent wallet rollback
      const isWithdraw = functionName === 'withdraw-funds'
      const withdrawAmountMicro = isWithdraw ? Math.max(0, Math.round(campaign.total * 1_000_000)) : 0
      const postConditions = isWithdraw
        ? [
            makeContractSTXPostCondition(
              CONTRACT_ADDRESS,
              CONTRACT_NAME,
              FungibleConditionCode.LessEqual,
              withdrawAmountMicro.toString()
            ),
          ]
        : []

      await openContractCall({
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: functionName, // <-- Use the correct function name
        functionArgs: [uintCV(campaignId)],
        postConditionMode: isWithdraw ? PostConditionMode.Allow : undefined,
        postConditions,
        anchorMode: AnchorMode.Any,
        onFinish: async (data) => {
          alert(`Transaction broadcasted! Waiting for confirmation...`);
          try {
            // This will wait for the transaction to be confirmed
            await waitForTransaction(data.txId);

            // Now, refresh the data to show the updated list
            await fetchAllData();
            alert(`Campaign finalized successfully!`);
          } catch (error) {
            console.error('Transaction confirmation failed:', error);
            alert('Transaction confirmation failed. Please check the explorer.');
          }
        },
        onCancel: () => {
          console.log('Campaign finalization cancelled');
        }
      });

    } catch (error) {
      console.error('Failed to finalize campaign:', error);
      alert('Failed to finalize campaign. Please try again.');
    } finally {
      setClosingCampaign(null);
    }
  };

  // Get user's campaigns
  const userCampaigns = user ? campaigns.filter((c) => c.owner === user.profile.stxAddress.testnet) : []
  const otherCampaigns = user ? campaigns.filter((c) => c.owner !== user.profile.stxAddress.testnet) : []

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-neutral-950 to-black text-neutral-100">
      {/* Navigation */}
      <nav className="backdrop-blur-md bg-neutral-800/50 border-b border-violet-300/30">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center space-x-2 text-neutral-100 hover:text-violet-400 transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Back to Home</span>
            </Link>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Settings className="h-6 w-6 text-violet-400" />
                <span className="text-neutral-100 font-semibold">Campaign Admin</span>
              </div>

              {/* Wallet Connection */}
              {!user ? (
                <button
                  onClick={handleConnect}
                  className="flex items-center space-x-2 bg-violet-600 hover:bg-violet-700 px-4 py-2 rounded-lg transition-colors"
                >
                  <LogIn size={16} />
                  <span>Connect Wallet</span>
                </button>
              ) : (
                <div className="text-xs text-neutral-300">
                  Connected: {user.profile.stxAddress.testnet?.slice(0, 8)}...
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-neutral-100 mb-4">Campaign Dashboard</h1>
          <p className="text-neutral-300 mb-6">Manage your crowdfunding campaigns</p>
          {loading && <div className="text-violet-400">Loading campaigns...</div>}
        </div>

        {/* Global Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <div className="backdrop-blur-md bg-neutral-800/50 rounded-xl p-6 border border-neutral-700 text-center">
            <Target className="h-8 w-8 text-violet-400 mx-auto mb-3" />
            <div className="text-2xl font-bold text-neutral-100 mb-1">{globalStats.totalRaised.toFixed(1)} STX</div>
            <div className="text-neutral-400 text-sm">Total Raised</div>
          </div>

          <div className="backdrop-blur-md bg-neutral-800/50 rounded-xl p-6 border border-neutral-700 text-center">
            <Users className="h-8 w-8 text-indigo-400 mx-auto mb-3" />
            <div className="text-2xl font-bold text-neutral-100 mb-1">{globalStats.totalContributors}</div>
            <div className="text-neutral-400 text-sm">Contributors</div>
          </div>

          <div className="backdrop-blur-md bg-neutral-800/50 rounded-xl p-6 border border-neutral-700 text-center">
            <TrendingUp className="h-8 w-8 text-indigo-400 mx-auto mb-3" />
            <div className="text-2xl font-bold text-neutral-100 mb-1">{globalStats.activeCampaigns}</div>
            <div className="text-neutral-400 text-sm">Active Campaigns</div>
          </div>

          <div className="backdrop-blur-md bg-neutral-800/50 rounded-xl p-6 border border-neutral-700 text-center">
            <BarChart3 className="h-8 w-8 text-violet-400 mx-auto mb-3" />
            <div className="text-2xl font-bold text-neutral-100 mb-1">{globalStats.totalCampaigns}</div>
            <div className="text-neutral-400 text-sm">Total Campaigns</div>
          </div>
        </div>

        {!user && (
          <div className="text-center mb-8">
            <div className="backdrop-blur-md bg-neutral-800/40 border border-neutral-700 rounded-xl p-8">
              <AlertCircle className="h-12 w-12 text-violet-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-neutral-100 mb-2">Connect Wallet Required</h3>
              <p className="text-neutral-300 mb-4">Connect your wallet to manage your campaigns</p>
              <button
                onClick={handleConnect}
                className="bg-violet-600 hover:bg-violet-700 px-6 py-2 rounded-lg transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          </div>
        )}

        {user && (
          <>
            {/* User's Campaigns */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-neutral-100 mb-6">Your Campaigns ({userCampaigns.length})</h2>

              {userCampaigns.length === 0 ? (
                <div className="backdrop-blur-md bg-neutral-800/40 rounded-xl p-8 text-center border border-neutral-700">
                  <div className="text-neutral-400 mb-4">You haven't created any campaigns yet</div>
                  <Link
                    href="/create"
                    className="bg-violet-600 hover:bg-violet-700 px-6 py-2 rounded-lg transition-colors"
                  >
                    Create Your First Campaign
                  </Link>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {userCampaigns.map((campaign) => {
                    const progress = campaign.goal > 0 ? (campaign.total / campaign.goal) * 100 : 0
                    const isClosing = closingCampaign === campaign.id

                    return (
                      <div
                        key={campaign.id}
                        className="backdrop-blur-md bg-neutral-800/50 rounded-xl p-6 border border-neutral-700"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-semibold text-neutral-100 mb-2">{campaign.title}</h3>
                            <p className="text-sm text-neutral-300 mb-2">{campaign.description}</p>
                            <p className="text-xs text-neutral-400 mb-4">Owner: {campaign.owner}</p>
                            <div className="flex items-center space-x-2">
                              <span
                                className={`text-xs px-2 py-1 rounded ${
                                  campaign.active ? "bg-violet-600 text-neutral-100" : "bg-neutral-700 text-neutral-300"
                                }`}
                              >
                                {campaign.active ? "Active" : "Closed"}
                              </span>
                              <span className="text-xs text-neutral-400">ID: {campaign.id}</span>
                            </div>
                          </div>

                          {campaign.active && (
                            <button
                              onClick={() => handleCloseCampaign(campaign.id)}
                              disabled={isClosing}
                              className="flex items-center space-x-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-600 border border-violet-500/30 px-3 py-2 rounded-lg text-sm transition-colors"
                            >
                              <X size={14} />
                              <span>{isClosing ? "Closing..." : "Close"}</span>
                            </button>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-neutral-400">Progress</span>
                            <span className="text-neutral-100">{progress.toFixed(1)}%</span>
                          </div>

                          <div className="w-full bg-neutral-800 rounded-full h-3">
                            <div
                              className={`h-3 rounded-full transition-all ${
                                progress >= 100 ? "bg-violet-500" : "bg-indigo-500"
                              }`}
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>

                          <div className="flex justify-between text-sm text-neutral-400">
                            <span>{campaign.total.toFixed(1)} STX raised</span>
                            <span>{campaign.goal.toFixed(1)} STX goal</span>
                          </div>

                          {progress >= 100 && (
                            <div className="flex items-center space-x-2 text-violet-400 text-sm">
                              <CheckCircle size={16} />
                              <span>Goal Reached! 🎉</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* All Other Campaigns */}
            {otherCampaigns.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold text-neutral-100 mb-6">Other Campaigns ({otherCampaigns.length})</h2>
                <div className="grid md:grid-cols-3 gap-6">
                  {otherCampaigns.map((campaign) => {
                    const progress = campaign.goal > 0 ? (campaign.total / campaign.goal) * 100 : 0

                    return (
                      <div
                        key={campaign.id}
                        className="backdrop-blur-md bg-neutral-800/40 rounded-xl p-4 border border-neutral-700"
                      >
                        <h3 className="text-lg font-semibold text-neutral-100 mb-2">{campaign.title}</h3>
                        <p className="text-xs text-neutral-400 mb-2">Owner: {campaign.owner.slice(0, 8)}...</p>

                        <div className="space-y-2">
                          <div className="w-full bg-neutral-800 rounded-full h-2">
                            <div
                              className="bg-violet-500 h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>

                          <div className="flex justify-between text-xs">
                            <span className="text-neutral-400">{campaign.total.toFixed(1)} STX</span>
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                campaign.active ? "bg-violet-600 text-neutral-100" : "bg-neutral-700 text-neutral-300"
                              }`}
                            >
                              {campaign.active ? "Active" : "Closed"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}