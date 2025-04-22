'use client'

import { getVotingProgram, getVotingProgramId } from '@project/anchor'
import { useConnection } from '@solana/wallet-adapter-react'
import { Cluster, Keypair, PublicKey } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import toast from 'react-hot-toast'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../ui/ui-layout'
import * as anchor from '@coral-xyz/anchor'

export function useVotingProgram() {
  const { connection } = useConnection()
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const provider = useAnchorProvider()
  const programId = useMemo(() => getVotingProgramId(cluster.network as Cluster), [cluster])
  const program = useMemo(() => getVotingProgram(provider, programId), [provider, programId])

  // Fetch all polls
  const polls = useQuery({
    queryKey: ['polls', { cluster }],
    queryFn: () => program.account.poll.all(),
  })

  const initializePoll = useMutation({
    mutationKey: ['initializePoll', { cluster }],
    mutationFn: ({
      pollId,
      description,
      pollStart,
      pollEnd,
    }: {
      pollId: number
      description: string
      pollStart: number
      pollEnd: number
    }) => {
      const bnPollId = new anchor.BN(pollId)
      return program.methods
        .initializePoll(bnPollId, description, new anchor.BN(pollStart), new anchor.BN(pollEnd))
        .accounts({
          poll: PublicKey.findProgramAddressSync([bnPollId.toArrayLike(Buffer, 'le', 8)], program.programId)[0],
          signer: provider.publicKey!,
          systemProgram: anchor.web3.SystemProgram.programId,
        }as any)
        .rpc()
    },
    onSuccess: (tx) => {
      transactionToast(tx)
      return polls.refetch()
    },
    onError: (err) => {
      console.error(err)
      toast.error('Failed to initialize poll')
    },
  })

  return {
    program,
    programId,
    polls,
    initializePoll,
  }
}