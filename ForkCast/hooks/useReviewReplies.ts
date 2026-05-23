// hooks/useReviewReplies.ts — Mock stub
interface UseReviewRepliesOptions {
  reviewId?: string;
  restaurantId?: string;
}

export const useReviewReplies = (_options: UseReviewRepliesOptions = {}) => {
  return {
    replies: [] as any[],
    loading: false,
    submitting: false,
    fetchReplies: async (_reviewId: string) => {},
    fetchRepliesForReviews: async (_reviewIds: string[]) => ({}),
    createReply: async (_reviewId: string, _content: string) => {},
    deleteReply: async (_replyId: string) => {},
    updateReply: async (_replyId: string, _content: string) => {},
    canReply: false,
  };
};