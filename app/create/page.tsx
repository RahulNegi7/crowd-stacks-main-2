"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, Calendar, Target, FileText, Loader2 } from "lucide-react"
import { uintCV, stringAsciiCV, AnchorMode } from "@stacks/transactions"
import { StacksTestnet } from "@stacks/network"
import { UserSession, AppConfig, showConnect, openContractCall } from "@stacks/connect"

// Contract configuration
const CONTRACT_ADDRESS = "ST1RVN5QPTET1RV9BJQX35JQWJFYG8YNHQEY5QN24" // Replace with your deployed address
const CONTRACT_NAME = "crowdfunding"
const network = new StacksTestnet()

// Wallet configuration
const appConfig = new AppConfig(["store_write", "publish_data"])
const userSession = new UserSession({ appConfig })

// TypeScript interfaces
interface FormData {
  title: string
  description: string
  goal: string
  deadline: string
}

interface FormErrors {
  title?: string
  goal?: string
  deadline?: string
}

export default function CreatePage() {
  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    goal: "",
    deadline: "",
  })
  const [isCreating, setIsCreating] = useState<boolean>(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      setUser(userSession.loadUserData())
    }
  }, [])

  // Connect wallet
  const handleConnect = () => {
    showConnect({
      appDetails: {
        name: "CrowdStacks - Crowdfunding DApp",
        icon: window.location.origin + "/favicon.ico",
      },
      redirectTo: "/create",
      userSession,
      onFinish: () => {
        window.location.reload()
      },
    })
  }

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.title.trim()) {
      newErrors.title = "Campaign title is required"
    }

    if (!formData.goal || Number.parseFloat(formData.goal) < 1) {
      newErrors.goal = "Goal must be at least 1 STX"
    }

    if (formData.deadline) {
      const selectedDate = new Date(formData.deadline)
      const today = new Date()
      if (selectedDate <= today) {
        newErrors.deadline = "Deadline must be in the future"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle form submission with blockchain integration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      alert("Please connect your wallet first")
      return
    }

    if (!validateForm()) return

    setIsCreating(true)

    try {
      // Convert goal to microSTX
      const goalInMicroSTX = Math.floor(Number.parseFloat(formData.goal) * 1_000_000)

      const response = await fetch("https://api.testnet.hiro.so/v2/info")
      const info = await response.json()
      const currentBlockHeight = info.stacks_tip_height

      // Convert deadline to block height (approximate)
      let deadlineBlock = 999999999 // Default very high block if no deadline
      if (formData.deadline) {
        const deadlineDate = new Date(formData.deadline)
        const now = new Date()
        deadlineBlock = Math.floor(Date.now() / 1000)
      }

      // Call the create-campaign contract function
      await openContractCall({
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "create-campaign",
        functionArgs: [
          stringAsciiCV(formData.title),
          stringAsciiCV(formData.description),
          uintCV(goalInMicroSTX),
          uintCV(deadlineBlock),
        ],
        anchorMode: AnchorMode.Any,
        postConditionMode: 2, // Allow
        onFinish: (data) => {
          console.log("Campaign creation transaction:", data)
          setFormData({ title: "", description: "", goal: "", deadline: "" })
          setErrors({})
          alert(`Campaign "${formData.title}" created successfully! Transaction ID: ${data.txId}`)

          // Redirect to home page after successful creation
          setTimeout(() => {
            window.location.href = "/"
          }, 2000)
        },
        onCancel: () => {
          console.log("Campaign creation cancelled")
        },
      })
    } catch (error) {
      console.error("Failed to create campaign:", error)
      alert("Failed to create campaign. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-neutral-950 to-black text-neutral-100">
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

            {/* Wallet Connection */}
            {!user ? (
              <button
                onClick={handleConnect}
                className="flex items-center space-x-2 bg-violet-600 hover:bg-violet-700 px-4 py-2 rounded-lg transition-colors"
              >
                <Plus size={16} />
                <span>Connect Wallet</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="text-xs text-neutral-300">
                  Connected: {user?.profile?.stxAddress?.testnet?.slice(0, 6)}...
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <div className="backdrop-blur-md bg-neutral-800/40 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 border border-neutral-700">
              <Plus className="h-10 w-10 text-violet-400" />
            </div>
            <h1 className="text-4xl font-bold text-neutral-100 mb-4">Create New Campaign</h1>
            <p className="text-neutral-300">Launch your crowdfunding campaign on the Stacks blockchain</p>

            {!user && (
              <div className="mt-4 p-4 bg-violet-500/20 border border-violet-400/30 rounded-lg">
                <p className="text-violet-400 text-sm">Please connect your wallet to create a campaign</p>
              </div>
            )}
          </div>

          <div className="backdrop-blur-md bg-neutral-800/50 rounded-2xl border border-neutral-700 p-8 shadow-xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Campaign Title */}
              <div>
                <label className="flex items-center space-x-2 text-neutral-100 text-sm font-medium mb-3">
                  <FileText size={16} />
                  <span>Campaign Title *</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter your campaign title..."
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  className={`w-full bg-neutral-800 border rounded-lg px-4 py-3 text-neutral-100 placeholder-neutral-500 focus:outline-none transition-colors ${
                    errors.title
                      ? "border-violet-500 focus:border-violet-500"
                      : "border-neutral-600 focus:border-violet-400"
                  }`}
                  disabled={!user}
                  required
                />
                {errors.title && <p className="text-violet-400 text-sm mt-2">{errors.title}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-neutral-100 text-sm font-medium mb-3">Campaign Description</label>
                <textarea
                  rows={4}
                  placeholder="Describe your project, goals, and how funds will be used..."
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-4 py-3 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-violet-400 transition-colors resize-none"
                  disabled={!user}
                />
              </div>

              {/* Goal and Deadline */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center space-x-2 text-neutral-100 text-sm font-medium mb-3">
                    <Target size={16} />
                    <span>Funding Goal (STX) *</span>
                  </label>
                  <input
                    type="number"
                    placeholder="1000"
                    min="1"
                    step="0.1"
                    value={formData.goal}
                    onChange={(e) => handleChange("goal", e.target.value)}
                    className={`w-full bg-neutral-800 border rounded-lg px-4 py-3 text-neutral-100 placeholder-neutral-500 focus:outline-none transition-colors ${
                      errors.goal
                        ? "border-violet-500 focus:border-violet-500"
                        : "border-neutral-600 focus:border-violet-400"
                    }`}
                    disabled={!user}
                    required
                  />
                  {errors.goal && <p className="text-violet-400 text-sm mt-2">{errors.goal}</p>}
                </div>

                <div>
                  <label className="flex items-center space-x-2 text-neutral-100 text-sm font-medium mb-3">
                    <Calendar size={16} />
                    <span>Campaign Deadline</span>
                  </label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => handleChange("deadline", e.target.value)}
                    min={new Date(Date.now() + 86400000).toISOString().split("T")[0]} // Tomorrow
                    className={`w-full bg-neutral-800 border rounded-lg px-4 py-3 text-neutral-100 focus:outline-none transition-colors ${
                      errors.deadline
                        ? "border-violet-500 focus:border-violet-500"
                        : "border-neutral-600 focus:border-violet-400"
                    }`}
                    disabled={!user}
                  />
                  {errors.deadline && <p className="text-violet-400 text-sm mt-2">{errors.deadline}</p>}
                </div>
              </div>

              {/* Campaign Preview */}
              {formData.title && formData.goal && (
                <div className="backdrop-blur-sm bg-violet-500/10 border border-violet-400/30 rounded-lg p-4">
                  <h3 className="text-violet-400 font-semibold mb-2">Campaign Preview</h3>
                  <div className="text-neutral-300 text-sm space-y-1">
                    <p>
                      <strong>Title:</strong> {formData.title}
                    </p>
                    <p>
                      <strong>Goal:</strong> {formData.goal} STX
                    </p>
                    {formData.description && (
                      <p>
                        <strong>Description:</strong> {formData.description}
                      </p>
                    )}
                    {formData.deadline && (
                      <p>
                        <strong>Deadline:</strong> {new Date(formData.deadline).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Info Box */}
              <div className="backdrop-blur-sm bg-violet-500/10 border border-violet-400/30 rounded-lg p-4">
                <h3 className="text-violet-400 font-semibold mb-2">Campaign Guidelines</h3>
                <ul className="text-neutral-300 text-sm space-y-1">
                  <li>• Minimum goal: 1 STX</li>
                  <li>• Contributors can get refunds if goal isn't reached</li>
                  <li>• Funds are transferred directly to campaign owner</li>
                  <li>• Campaign duration: set by deadline or runs indefinitely</li>
                  <li>• Transaction will require STX for gas fees</li>
                </ul>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!formData.title || !formData.goal || isCreating || !user}
                className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-neutral-600 text-white font-semibold py-4 px-6 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 disabled:cursor-not-allowed"
              >
                {isCreating ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                <span>{isCreating ? "Creating Campaign..." : "Create Campaign"}</span>
              </button>

              {!user && (
                <p className="text-center text-neutral-300 text-sm">Connect your wallet above to create a campaign</p>
              )}
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}