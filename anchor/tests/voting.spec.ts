import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
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
    let poll_start = Math.floor(Date.now() / 1000) + 60;
    let poll_end = poll_start + 60 * 60 * 24;

    const now = Math.floor(Date.now() / 1000);
    const start = now - 10;
    const end = now + 60;

    await votingProgram.methods.initializePoll(
      new anchor.BN(1),
      "What is your favorite color?",

      new anchor.BN(poll_start),
      new anchor.BN(poll_end),

      new anchor.BN(start),
      new anchor.BN(end)
    ).rpc();

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
      votingProgram.programId,
    );

    const poll = await votingProgram.account.poll.fetch(pollAddress);

    console.log(poll);

    expect(poll.pollId.toNumber()).toBe(1);
    expect(poll.description).toBe("What is your favorite color?");
    expect(poll.pollStart.toNumber()).toBe(poll_start);
  });

  it("fails to initialize poll with invalid timestamp", async () => {
    try {
      await votingProgram.methods.initializePoll(
        new anchor.BN(2),                              
        "Invalid timestamp test",                      
        new anchor.BN(100),                            
        new anchor.BN(1739370789),                     
      ).rpc();
      // if the transaction does not throw, the test fails
      fail("Expected initializePoll to throw due to invalid timestamp");
    } catch (err: any) {
      const logs = err.logs || [];
      const foundError = logs.some((log: string) =>
        log.includes("Provided timestamp is not a valid Unix timestamp.")
      );
      expect(foundError).toBe(true);
    }

    expect(poll.pollStart.toNumber()).toBe(start);

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

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
      votingProgram.programId,
    )
    const poll = await votingProgram.account.poll.fetch(pollAddress);
    console.log(poll);
    expect(poll.candidateAmount.toNumber()).toBe(2);
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

    const [pollAddress]=PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
      votingProgram.programId,
    );
    const poll=await votingProgram.account.poll.fetch(pollAddress);
    expect(poll.totalVotes.toNumber()).toBe(3);
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

  it("should fail to vote before poll start", async () => {
    const now = Math.floor(Date.now() / 1000);
    const start = now + 60;
    const end = now + 120;

    await votingProgram.methods.initializePoll(
      new anchor.BN(2),
      "Should this fail before start?",
      new anchor.BN(start),
      new anchor.BN(end)
    ).rpc();

    await votingProgram.methods.initializeCandidate(
      "EarlyBird",
      new anchor.BN(2)
    ).rpc();

    await expect(
      votingProgram.methods.vote("EarlyBird", new anchor.BN(2)).rpc()
    ).rejects.toMatchObject({
      error: {
        errorMessage: "Poll has not started yet.",
      },
    });
  });


  it("should fail to vote after poll end", async () => {
    const now = Math.floor(Date.now() / 1000);
    const start = now - 200;
    const end = now - 100;

    await votingProgram.methods.initializePoll(
      new anchor.BN(3),
      "Too late?",
      new anchor.BN(start),
      new anchor.BN(end)
    ).rpc();

    await votingProgram.methods.initializeCandidate("LateComer", new anchor.BN(3)).rpc();

    await expect(
      votingProgram.methods.vote("LateComer", new anchor.BN(3)).rpc()
    ).rejects.toMatchObject({
      error: {
        errorMessage: "Poll has ended.",
      },
    });
  });
});