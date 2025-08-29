"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import Confetti from "react-confetti"
import { Wallet, Target, Users, Calendar, TrendingUp, ArrowRight, Plus, BarChart3, Home, LogIn } from "lucide-react"
import {
  callReadOnlyFunction,
  cvToJSON,
  uintCV,
  AnchorMode,
  PostConditionMode,
  makeStandardSTXPostCondition,
  FungibleConditionCode,
} from "@stacks/transactions"
import { StacksTestnet } from "@stacks/network"
import { UserSession, AppConfig, showConnect, openContractCall } from "@stacks/connect"
import { Poppins } from "next/font/google"

// Contract configuration - MUST MATCH create/page.tsx and admin/page.tsx
const CONTRACT_ADDRESS = "ST1RVN5QPTET1RV9BJQX35JQWJFYG8YNHQEY5QN24" // Replace with your deployed address
const CONTRACT_NAME = "crowdfunding"
const network = new StacksTestnet()

// Wallet configuration
const appConfig = new AppConfig(["store_write", "publish_data"])
const userSession = new UserSession({ appConfig })

// TypeScript interfaces - MUST MATCH admin/page.tsx
interface Campaign {
  id: number
  title: string
  description: string
  goal: number
  total: number
  deadline: number
  owner: string
  active: boolean
  blocksRemaining?: number
}

interface GlobalStats {
  totalRaised: number
  totalContributors: number
  activeCampaigns: number
}

interface TooltipProps {
  children: React.ReactNode
  text: string
  position?: "top" | "bottom" | "left" | "right"
}

// Helper functions for parsing Clarity values - MUST MATCH admin/page.tsx
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
    owner: d.owner?.value || "",
    active: jBool(d.active),
  }
}

// Countdown helpers (match admin behavior)
const formatMinutes = (totalMin: number) => {
  if (totalMin <= 0) return "Deadline passed"
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = Math.floor(totalMin % 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0 || d > 0) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(" ") + " left"
}

const countdownFor = (c: Campaign): string => {
  if (!c.deadline || c.deadline <= 0) return "No deadline"
  const unixThreshold = 1_000_000_000
  if (c.deadline > unixThreshold) {
    const secsLeft = Math.max(0, c.deadline - Math.floor(Date.now() / 1000))
    return formatMinutes(Math.floor(secsLeft / 60))
  }
  const br = typeof c.blocksRemaining === 'number' ? c.blocksRemaining : -1
  return formatMinutes(br * 10)
}

// Tooltip component
const Tooltip: React.FC<TooltipProps> = ({ children, text, position = "top" }) => {
  return (
    <div className="relative group">
      {children}
      <div
        className={`absolute z-50 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap
        ${position === "top" ? "bottom-full mb-2 left-1/2 transform -translate-x-1/2" : ""}
        ${position === "bottom" ? "top-full mt-2 left-1/2 transform -translate-x-1/2" : ""}
      `}
      >
        {text}
        <div
          className={`absolute w-2 h-2 bg-gray-900 transform rotate-45
          ${position === "top" ? "top-full left-1/2 -translate-x-1/2 -mt-1" : ""}
          ${position === "bottom" ? "bottom-full left-1/2 -translate-x-1/2 -mb-1" : ""}
        `}
        ></div>
      </div>
    </div>
  )
}

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
})

export default function HomePage() {
  // UI State
  const [isContributing, setIsContributing] = useState<boolean>(false)
  const [contributionAmount, setContributionAmount] = useState<string>("")
  const [showConfetti, setShowConfetti] = useState<boolean>(false)
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const [selectedCampaign, setSelectedCampaign] = useState<number>(0)

  // Blockchain State
  const [user, setUser] = useState<any>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalRaised: 0,
    totalContributors: 0,
    activeCampaigns: 0,
  })
  const [loading, setLoading] = useState<boolean>(true)

  // Derived: only show active campaigns in the main app
  const visibleCampaigns: Campaign[] = campaigns.filter((c) => c.active)

  // Current campaign for display
  const currentCampaign: Campaign = visibleCampaigns[selectedCampaign] || {
    id: 0,
    title: "No campaigns yet",
    description: "Create the first campaign to get started!",
    goal: 1000,
    total: 0,
    deadline: 0,
    owner: "",
    active: false,
  }

  // Keep selected index valid when active list changes
  useEffect(() => {
    if (selectedCampaign >= visibleCampaigns.length) {
      setSelectedCampaign(0)
    }
  }, [visibleCampaigns.length])

  // Calculate progress
  const progressPercentage = currentCampaign.goal > 0 ? (currentCampaign.total / currentCampaign.goal) * 100 : 0
  const goalReached = currentCampaign.total >= currentCampaign.goal

  // Window size for confetti
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Check wallet connection on load
  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      setUser(userSession.loadUserData())
    }
    fetchAllData()
  }, [])

  // Trigger confetti when goal is reached
  useEffect(() => {
    if (goalReached && !showConfetti && currentCampaign.total > 0) {
      setShowConfetti(true)
      const timer = setTimeout(() => setShowConfetti(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [goalReached, showConfetti, currentCampaign.total])

  // Auto-refresh data every 30 seconds - SYNCS WITH create/admin PAGES
  useEffect(() => {
    const interval = setInterval(fetchAllData, 30000)
    return () => clearInterval(interval)
  }, [])

  // Connect wallet
  const handleConnect = () => {
    showConnect({
      appDetails: {
        name: "CrowdStacks - Crowdfunding DApp",
        icon: window.location.origin + "/favicon.ico",
      },
      redirectTo: "/",
      userSession,
      onFinish: () => {
        window.location.reload()
      },
    })
  }

  // Disconnect wallet
  const handleDisconnect = () => {
    userSession.signUserOut("/")
    setUser(null)
  }

  // Fetch all blockchain data - MATCHES admin/page.tsx exactly
  const fetchAllData = async () => {
    try {
      setLoading(true)

      // Get global stats - SAME FUNCTIONS AS admin/page.tsx
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
          functionName: "get-campaign-count", // This gets updated by create/page.tsx
          functionArgs: [],
          network,
          senderAddress: CONTRACT_ADDRESS,
        }),
      ])

      // Update global stats
      setGlobalStats({
        totalRaised: Number(cvToJSON(totalSTX).value) / 1_000_000, // Convert from microSTX
        totalContributors: Number(cvToJSON(totalContributors).value),
        activeCampaigns: Number(cvToJSON(activeCampaigns).value), // Updated by admin/page.tsx close-campaign
      })

      // Fetch all campaigns - WILL INCLUDE NEW ONES FROM create/page.tsx
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

      // Enrich with blocks-remaining for countdowns
      const statusPromises = fetchedCampaigns.map((c) =>
        callReadOnlyFunction({
          contractAddress: CONTRACT_ADDRESS,
          contractName: CONTRACT_NAME,
          functionName: 'get-campaign-status',
          functionArgs: [uintCV(c.id)],
          network,
          senderAddress: CONTRACT_ADDRESS,
        })
      )
      const statusResults = await Promise.all(statusPromises)
      const withStatus = fetchedCampaigns.map((c, i) => {
        try {
          const json: any = cvToJSON(statusResults[i])
          const tuple = json?.value?.value ?? json?.value ?? {}
          const node = tuple['blocks-remaining']
          const raw = typeof node?.value !== 'undefined' ? node.value : node
          const br = Number(raw)
          return { ...c, blocksRemaining: Number.isFinite(br) ? br : 0 }
        } catch {
          return { ...c }
        }
      })

      setCampaigns(withStatus)
    } catch (error) {
      console.error("Error fetching blockchain data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Handle contribution - MATCHES contract function signature
  const handleContribute = async () => {
    if (!user) {
      alert("Please connect your wallet first")
      return
    }

    if (!contributionAmount || Number.parseFloat(contributionAmount) < 1) {
      alert("Minimum contribution is 1 STX")
      return
    }

    if (!currentCampaign.active) {
      alert("This campaign is not active")
      return
    }

    setIsContributing(true)

    try {
      const amountInMicroSTX = Math.floor(Number.parseFloat(contributionAmount) * 1_000_000)
      const senderAddress = user?.profile?.stxAddress?.testnet || user?.profile?.stxAddress?.mainnet
      const postConditions = [
        makeStandardSTXPostCondition(senderAddress, FungibleConditionCode.LessEqual, BigInt(amountInMicroSTX)),
      ]

      await openContractCall({
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "contribute", // MATCHES contract function
        functionArgs: [uintCV(currentCampaign.id), uintCV(amountInMicroSTX)], // CORRECT TYPES
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Deny,
        postConditions,
        onFinish: () => {
          setContributionAmount("")
          setTimeout(() => {
            fetchAllData() // Refresh to show updated totals
            alert(`Successfully contributed ${contributionAmount} STX!`)
          }, 2000)
        },
        onCancel: () => {
          console.log("Transaction cancelled")
        },
      })
    } catch (error) {
      console.error("Contribution failed:", error)
      alert("Contribution failed. Please try again.")
    } finally {
      setIsContributing(false)
    }
  }

  return (
    <div className="min-h-screen relative bg-gradient-to-b from-black via-neutral-950 to-black text-neutral-100">
      {/* Confetti Animation */}
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
        />
      )}

      {/* Navigation */}
      <nav className="backdrop-blur-md bg-neutral-800/50 border-b border-violet-300/30 sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-violet-400" />
              <span className="text-2xl font-bold text-neutral-100">CrowdStacks</span>
            </div>
            <div className="flex items-center space-x-6">
              <Link
                href="/"
                className="flex items-center space-x-2 text-neutral-100 hover:text-violet-400 transition-colors"
              >
                <Home size={20} />
                <span>Home</span>
              </Link>
              <Link
                href="/create"
                className="flex items-center space-x-2 text-neutral-300 hover:text-violet-400 transition-colors"
              >
                <Plus size={20} />
                <span>Create</span>
              </Link>
              <Link
                href="/admin"
                className="flex items-center space-x-2 text-neutral-300 hover:text-violet-400 transition-colors"
              >
                <BarChart3 size={20} />
                <span>Admin</span>
              </Link>

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
                <div className="flex items-center space-x-2">
                  <div className="text-xs text-neutral-300">
                    {user?.profile?.stxAddress?.testnet?.slice(0, 6)}...{user?.profile?.stxAddress?.testnet?.slice(-4)}
                  </div>
                  <button onClick={handleDisconnect} className="text-xs text-neutral-300 hover:text-neutral-100">
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-12">
        {/* Hero Section */}
        <section className="text-center mb-16">
          <h1 className={`${poppins.className} text-6xl font-bold text-violet-400 mb-6`}>Player-Funded. Developer-Owned</h1>
          <p className={`${poppins.className} text-xl text-neutral-300 max-w-2xl mx-auto`}>
            Fund the next generation of indie games, powered by the Stacks blockchain.
          </p>
          {loading && <div className="mt-4 text-violet-400">Loading blockchain data...</div>}
        </section>

        {/* Campaign Selector */}
        {visibleCampaigns.length > 1 && (
          <section className="mb-8">
            <div className="flex justify-center">
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(Number(e.target.value))}
                className="bg-neutral-800 text-neutral-100 px-4 py-2 rounded-lg border border-neutral-600 focus:border-violet-400"
              >
                {visibleCampaigns.map((campaign, index) => (
                  <option key={index} value={index}>
                    Campaign {index}: {campaign.title}
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}

        {/* Goal Reached Banner */}
        {goalReached && currentCampaign.total > 0 && (
          <section className="mb-12">
            <div className="backdrop-blur-md bg-violet-500/20 border border-violet-400/30 rounded-2xl p-6 text-center">
              <div className="flex items-center justify-center space-x-2 text-violet-400 mb-2">
                <Target size={24} />
                <span className="text-2xl font-bold">🎉 FUNDING GOAL REACHED! 🎉</span>
              </div>
              <p className="text-violet-300">
                Amazing! This campaign has successfully reached its funding goal of {currentCampaign.goal} STX
              </p>
            </div>
          </section>
        )}

        {/* Current Campaign Display */}
        <section className="mb-16">
          <div className="backdrop-blur-md bg-neutral-800/50 rounded-2xl border border-neutral-700 p-8 shadow-xl">
            <div className="grid lg:grid-cols-3 gap-8 items-start">
              {/* Campaign Info */}
              <div className="lg:col-span-2">
                <div className="flex items-center space-x-2 mb-4">
                  <h2 className="text-3xl font-bold text-neutral-100">{currentCampaign.title}</h2>
                  {goalReached && <span className="text-2xl">🏆</span>}
                </div>
                <p className="text-neutral-300 mb-2">{currentCampaign.description}</p>
                <p className="text-sm text-neutral-400 mb-6">Owner: {currentCampaign.owner}</p>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400">Progress</span>
                    <span className="text-neutral-100 font-semibold">{progressPercentage.toFixed(1)}%</span>
                  </div>

                  <div className="w-full bg-neutral-800 rounded-full h-4 relative overflow-hidden">
                    <div
                      className={`h-4 rounded-full transition-all duration-1000 ease-out ${
                        goalReached ? "bg-violet-500" : "bg-indigo-500"
                      }`}
                      style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                    >
                      {goalReached && <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full"></div>}
                    </div>
                  </div>

                    <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="flex items-center justify-center space-x-2 text-violet-400">
                        <Target size={20} />
                        <span className="text-2xl font-bold text-neutral-100">{currentCampaign.total.toFixed(1)}</span>
                      </div>
                      <p className="text-neutral-400 text-sm">STX Raised</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-center space-x-2 text-indigo-400">
                        <Target size={20} />
                        <span className="text-2xl font-bold text-neutral-100">{currentCampaign.goal.toFixed(1)}</span>
                      </div>
                      <p className="text-neutral-400 text-sm">STX Goal</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-center space-x-2 text-indigo-400">
                        <Calendar size={20} />
                        <span className="text-2xl font-bold text-neutral-100">
                          {currentCampaign.active ? "Active" : "Closed"}
                        </span>
                      </div>
                      <p className="text-neutral-400 text-sm">Status</p>
                    </div>
                    <div className="text-sm text-neutral-300">
                      <span className="opacity-80">Time left:</span> {countdownFor(currentCampaign)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Panel */}
              <div className="space-y-4">
                <div className="backdrop-blur-sm bg-neutral-800/40 rounded-xl p-6 border border-neutral-700">
                  <h3 className="text-xl font-semibold text-neutral-100 mb-4 flex items-center space-x-2">
                    <Wallet size={20} />
                    <span>Contribute</span>
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-neutral-300 text-sm mb-2">Amount (STX)</label>
                      <input
                        type="number"
                        placeholder="Enter STX amount (min: 1)"
                        value={contributionAmount}
                        onChange={(e) => setContributionAmount(e.target.value)}
                        min="1"
                        step="0.1"
                        className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-4 py-3 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-violet-400 transition-colors"
                        disabled={!user || !currentCampaign.active}
                      />
                    </div>

                    <button
                      onClick={handleContribute}
                      disabled={!contributionAmount || isContributing || !currentCampaign.active || !user}
                      className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-neutral-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 disabled:cursor-not-allowed"
                    >
                      <Wallet size={20} />
                      <span>{isContributing ? "Contributing..." : "Contribute STX"}</span>
                      {!isContributing && <ArrowRight size={20} />}
                    </button>

                    {!user && <p className="text-xs text-neutral-300 text-center">Connect wallet to contribute</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Global Stats */}
        <section className="mb-16">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="backdrop-blur-md bg-neutral-800/50 rounded-xl p-6 border border-neutral-700 text-center">
              <Target className="h-8 w-8 text-violet-400 mx-auto mb-4" />
              <h3 className="text-3xl font-bold text-neutral-100 mb-2">{globalStats.totalRaised.toFixed(1)}</h3>
              <p className="text-neutral-400">Total STX Raised</p>
            </div>

            <div className="backdrop-blur-md bg-neutral-800/50 rounded-xl p-6 border border-neutral-700 text-center">
              <Users className="h-8 w-8 text-indigo-400 mx-auto mb-4" />
              <h3 className="text-3xl font-bold text-neutral-100 mb-2">{globalStats.totalContributors}</h3>
              <p className="text-neutral-400">Total Contributors</p>
            </div>

            <div className="backdrop-blur-md bg-neutral-800/50 rounded-xl p-6 border border-neutral-700 text-center">
              <BarChart3 className="h-8 w-8 text-indigo-400 mx-auto mb-4" />
              <h3 className="text-3xl font-bold text-neutral-100 mb-2">{globalStats.activeCampaigns}</h3>
              <p className="text-neutral-400">Active Campaigns</p>
            </div>
          </div>
        </section>

        {/* All Campaigns List */}
        {visibleCampaigns.length > 0 && (
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-neutral-100 text-center mb-8">All Campaigns</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleCampaigns.map((campaign, index) => {
                const campaignProgress = campaign.goal > 0 ? (campaign.total / campaign.goal) * 100 : 0
                return (
                  <div
                    key={index}
                    className={`backdrop-blur-md bg-neutral-800/40 rounded-xl p-6 border border-neutral-700 cursor-pointer transition-all hover:bg-neutral-800 ${
                      selectedCampaign === index ? "ring-2 ring-violet-400" : ""
                    }`}
                    onClick={() => setSelectedCampaign(index)}
                  >
                    <h3 className="text-xl font-semibold text-neutral-100 mb-2">{campaign.title}</h3>
                    <p className="text-sm text-neutral-300 mb-4 line-clamp-2">{campaign.description}</p>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Progress</span>
                        <span className="text-neutral-100">{campaignProgress.toFixed(1)}%</span>
                      </div>

                      <div className="w-full bg-neutral-800 rounded-full h-2">
                        <div
                          className="bg-violet-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(campaignProgress, 100)}%` }}
                        />
                      </div>
                      <div className="text-xs text-neutral-300">
                        <span className="opacity-80">Time left:</span> {countdownFor(campaign)}
                      </div>

                      <div className="flex justify-between items-center">
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
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* How It Works */}
        <section>
          <h2 className="text-4xl font-bold text-neutral-100 text-center mb-12">How It Works</h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="backdrop-blur-md bg-neutral-800/40 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 border border-neutral-700">
                <Plus className="h-10 w-10 text-violet-400" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-100 mb-4">1. Create Campaign</h3>
              <p className="text-neutral-300">Set your funding goal and campaign details on the Stacks blockchain</p>
            </div>

            <div className="text-center">
              <div className="backdrop-blur-md bg-neutral-800/40 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 border border-neutral-700">
                <Target className="h-10 w-10 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-100 mb-4">2. Get Funded</h3>
              <p className="text-neutral-300">Share your campaign and receive STX contributions from supporters</p>
            </div>

            <div className="text-center">
              <div className="backdrop-blur-md bg-neutral-800/40 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 border border-neutral-700">
                <TrendingUp className="h-10 w-10 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-100 mb-4">3. Build & Deliver</h3>
              <p className="text-neutral-300">
                Use the funds to build your project and deliver value to Bitcoin ecosystem
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
