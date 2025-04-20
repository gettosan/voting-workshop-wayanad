import * as anchor from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { BankrunProvider, startAnchor, } from "anchor-bankrun";
import { Voting } from "../target/types/voting";

const IDL = require("../target/idl/voting.json");
const PROGRAM_ID = new PublicKey(IDL.address);

describe("Voting", () => {
  let context;
  let provider;
  let votingProgram: anchor.Program<Voting>;
  let voter1: Keypair;
  let voter2: Keypair;

  beforeAll(async () => {
    voter1 = anchor.web3.Keypair.generate();
    voter2 = anchor.web3.Keypair.generate();

    context = await startAnchor(
      '',
      [{ name: "voting", programId: PROGRAM_ID }],
      [
        {
          address: voter1.publicKey,
          info: {
            lamports: 2 * LAMPORTS_PER_SOL,
            owner: SystemProgram.programId,
            data: Buffer.alloc(0),
            executable: false,
          },
        },
        {
          address: voter2.publicKey,
          info: {
            lamports: 2 * LAMPORTS_PER_SOL,
            owner: SystemProgram.programId,
            data: Buffer.alloc(0),
            executable: false,
          },
        },
      ]
    );

    provider = new BankrunProvider(context);
    votingProgram = new anchor.Program<Voting>(IDL, provider);
  });


  it("initializes a poll", async () => {
    await votingProgram.methods.initializePoll(
      new anchor.BN(1),
      "What is your favorite color?",
      new anchor.BN(100),
      new anchor.BN(1739370789),
    ).rpc();

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
      votingProgram.programId,
    );

    const poll = await votingProgram.account.poll.fetch(pollAddress);

    console.log(poll);

    expect(poll.pollId.toNumber()).toBe(1);
    expect(poll.description).toBe("What is your favorite color?");
    expect(poll.pollStart.toNumber()).toBe(100);
  });

  it("initializes candidates", async () => {
    await votingProgram.methods.initializeCandidate(
      "Pink",
      new anchor.BN(1),
    ).rpc();
    await votingProgram.methods.initializeCandidate(
      "Blue",
      new anchor.BN(1),
    ).rpc();

    const [pinkAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Pink")],
      votingProgram.programId,
    );
    const pinkCandidate = await votingProgram.account.candidate.fetch(pinkAddress);
    console.log(pinkCandidate);
    expect(pinkCandidate.candidateVotes.toNumber()).toBe(0);
    expect(pinkCandidate.candidateName).toBe("Pink");

    const [blueAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Blue")],
      votingProgram.programId,
    );
    const blueCandidate = await votingProgram.account.candidate.fetch(blueAddress);
    console.log(blueCandidate);
    expect(blueCandidate.candidateVotes.toNumber()).toBe(0);
    expect(blueCandidate.candidateName).toBe("Blue");
  });

  it("votes for a single candidate", async () => {
    await votingProgram.methods
      .vote("Pink", new anchor.BN(1))
      .accounts({ signer: voter1.publicKey })
      .signers([voter1])
      .rpc();

    await votingProgram.methods
      .vote("Pink", new anchor.BN(1))
      .accounts({ signer: voter2.publicKey })
      .signers([voter2])
      .rpc();


    const [pinkAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Pink")],
      votingProgram.programId,
    );
    const pinkCandidate = await votingProgram.account.candidate.fetch(pinkAddress);
    expect(pinkCandidate.candidateVotes.toNumber()).toBe(2);
    expect(pinkCandidate.candidateName).toBe("Pink");

    const [blueAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Blue")],
      votingProgram.programId,
    );
    const blueCandidate = await votingProgram.account.candidate.fetch(blueAddress);
    expect(blueCandidate.candidateVotes.toNumber()).toBe(0);
    expect(blueCandidate.candidateName).toBe("Blue");
  });

  it("prevents the same voter from voting different candidates", async () => {
    try {
      await votingProgram.methods
        .vote("Blue", new anchor.BN(1))
        .accounts({ signer: voter1.publicKey })
        .signers([voter1])
        .rpc();

      throw new Error("Second vote succeeded but should have failed!");
    } catch (err: any) {
      expect(err.toString()).toMatch(/Voter has already cast a vote/i);
    }
  });
});