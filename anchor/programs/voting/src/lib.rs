#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

declare_id!("coUnmi3oBUtwtd9fjeAvSsJssXh5A5xyPbhpewyzRVF");

#[program]
pub mod voting {
    use super::*;

    pub fn initialize_poll(ctx: Context<InitializePoll>, 
                            poll_id: u64,
                            description: String,
                            poll_start: u64,
                            poll_end: u64) -> Result<()> {

        let poll = &mut ctx.accounts.poll;
        poll.poll_id = poll_id;
        poll.description = description;
        poll.poll_start = poll_start;
        poll.poll_end = poll_end;
        poll.candidate_amount = 0;
        Ok(())
    }

    pub fn initialize_candidate(ctx: Context<InitializeCandidate>, 
                                candidate_name: String,
                                poll_id: u64
                            ) -> Result<()> {
        let candidate = &mut ctx.accounts.candidate;
        candidate.candidate_name = candidate_name;
        candidate.poll_id = poll_id;
        candidate.candidate_votes = 0;
        Ok(())
    }

    pub fn vote(ctx: Context<Vote>, _candidate_name: String, _poll_id: u64) -> Result<()> {
        let candidate = &mut ctx.accounts.candidate;
        let voter_record = &mut ctx.accounts.voter_record;

        if voter_record.has_voted {
          return Err(error!(Error::AlreadyVoted));
      }
  
      voter_record.voter = ctx.accounts.signer.key();
      voter_record.poll_id = _poll_id;
      voter_record.has_voted = true;
  
      candidate.candidate_votes += 1;
        
        msg!("Voted for candidate: {}", candidate.candidate_name);
        msg!("Votes: {}", candidate.candidate_votes);
        Ok(())
    }

}

#[derive(Accounts)]
#[instruction(candidate_name: String, poll_id: u64)]
pub struct Vote<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        seeds = [poll_id.to_le_bytes().as_ref()],
        bump
      )]
    pub poll: Account<'info, Poll>,

    #[account(
      mut,
      seeds = [poll_id.to_le_bytes().as_ref(), candidate_name.as_ref()],
      bump
    )]
    pub candidate: Account<'info, Candidate>,
    #[account(
      init_if_needed, // this prevents from creating account if it already exists
      payer = signer,
      space = 8 + VoterRecord::INIT_SPACE,
      seeds = [poll_id.to_le_bytes().as_ref(), signer.key().as_ref()],
      bump
    )]
    pub voter_record : Account<'info,VoterRecord>,

    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction(candidate_name: String, poll_id: u64)]
pub struct InitializeCandidate<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [poll_id.to_le_bytes().as_ref()],
        bump
      )]
    pub poll: Account<'info, Poll>,

    #[account(
      init,
      payer = signer,
      space = 8 + Candidate::INIT_SPACE,
      seeds = [poll_id.to_le_bytes().as_ref(), candidate_name.as_ref()],
      bump
    )]
    pub candidate: Account<'info, Candidate>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Candidate {
    #[max_len(32)]
    pub candidate_name: String,
    pub candidate_votes: u64,
    pub poll_id: u64,
}

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct InitializePoll<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
      init,
      payer = signer,
      space = 8 + Poll::INIT_SPACE,
      seeds = [poll_id.to_le_bytes().as_ref()],
      bump
    )]
    pub poll: Account<'info, Poll>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Poll {
    pub poll_id: u64,
    #[max_len(200)]
    pub description: String,
    pub poll_start: u64,
    pub poll_end: u64,
    pub candidate_amount: u64,
}

#[account]
#[derive(InitSpace)]
pub struct VoterRecord {
    pub voter: Pubkey,
    pub poll_id: u64,
    pub has_voted: bool,
}

#[error_code]
pub enum Error {
    #[msg("Voter has already cast a vote in this poll")]
    AlreadyVoted,
}