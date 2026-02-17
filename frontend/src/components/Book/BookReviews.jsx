
// frontend/src/components/Book/BookReviews.jsx
import React, { useState, useEffect, useContext } from 'react';
import { MessageCircle } from 'lucide-react';
import { Modal, Rate, Input, Button, Form, message, Avatar } from 'antd';
import axios from 'axios';
import config from '../../config';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';

const { TextArea } = Input;

const normalizeFromApi = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${config.API_URL}${url}`;
  return url;
};

function BookReviews({ bookId }) {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({
    average: 0,
    total: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    try {
      const [statsRes, reviewsRes] = await Promise.all([
        axios.get(`${config.API_URL}/api/books/${bookId}/reviews/stats`),
        axios.get(`${config.API_URL}/api/books/${bookId}/reviews`)
      ]);
      setStats(statsRes.data);
      setReviews(reviewsRes.data);
    } catch (err) {
      console.error('Failed to load reviews', err);
      message.error(t('reviews.load_error') || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bookId) fetchData();
  }, [bookId]);

  const onSubmitReview = async (values) => {
    try {
      await axios.post(
        `${config.API_URL}/api/books/${bookId}/reviews`,
        {
          rating: values.rating,                 // ← now bound correctly
          review_text: values.review_text,
          reviewer_name: values.reviewer_name || user?.name || 'Anonymous'
        }
        // ← no withCredentials needed for guest posting
      );
      message.success(t('review_submitted') || 'Thank you! Your review has been submitted.');
      form.resetFields();
      setModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('submit review failed:', err?.response?.status, err?.response?.data, err);
      message.error(err.response?.data?.message || 'Failed to submit review');
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-gray-500">
        {t('reviews.loading') || 'Loading reviews...'}
      </div>
    );
  }

  return (
    <div className="book-reviews mt-24 bg-gradient-to-b from-purple-50/50 to-transparent">
      <div className="container">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          {t('customer_reviews') || 'Customer Reviews'}
        </h2>

        <div className="grid lg:grid-cols-4 gap-12">
          {/* Rating Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-xl p-8 sticky top-24 border border-purple-100">
              <div className="text-center mb-8">
                <div className="text-7xl font-bold text-purple-600">
                  {stats.average.toFixed(1)}
                </div>
                <Rate disabled allowHalf value={stats.average} className="text-4xl mt-3" style={{ color: '#9333ea' }} />
                <p className="text-gray-600 mt-3 text-lg">
                  {t('review_count', { count: stats.total })}
                </p>
              </div>

              {/* Star distribution */}
              {[5, 4, 3, 2, 1].map(star => (
                <div key={star} className="flex items-center gap-4 mb-4">
                  <span className="text-sm font-medium w-10">{star} star</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      style={{ width: `${stats.total > 0 ? (stats.distribution[star] / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">
                    {stats.distribution[star] || 0}
                  </span>
                </div>
              ))}

              <Button
                type="primary"
                size="large"
                block
                onClick={() => setModalOpen(true)}
                className="mt-10 h-14 text-lg font-bold rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600"
              >
                {t('write_review')}
              </Button>
            </div>
          </div>

          {/* Reviews List */}
          <div className="lg:col-span-3 space-y-8">
            {reviews.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-3xl shadow-lg">
                <MessageCircle size={80} className="mx-auto text-purple-300 mb-6" />
                <h3 className="text-2xl font-bold text-gray-700 mb-4">
                  {t('reviews.no_reviews_yet')}
                </h3>
                <p className="text-gray-500 mb-8">
                  {t('reviews.be_the_first')}
                </p>
                <Button size="large" type="primary" onClick={() => setModalOpen(true)}>
                  {t('reviews.write_first')}
                </Button>
              </div>
            ) : (
              reviews.map(review => {
                const initials = (review.reviewer_name || 'Anonymous')
                  .split(' ')
                  .map(s => s[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                const avatarSrc = review.reviewer_photo_url
                  ? normalizeFromApi(review.reviewer_photo_url)
                  : undefined;

                return (
                  <div key={review.id} className="bg-white rounded-3xl shadow-lg p-8 border border-purple-100 hover:border-purple-300 transition-all">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <Avatar
                          src={avatarSrc}
                          size={56}
                          className="review-avatar"
                          alt="Reviewer avatar"
                          //onError={(e) => { e.currentTarget.src = ''; return false; }}

                          onError={(e) => {
                            if (e?.currentTarget) {
                              e.currentTarget.src = '/assets/avatar-placeholder.png';
                            }
                            return false; // keep initials fallback if image fails
                          }}

                        >
                          {!avatarSrc && initials}
                        </Avatar>

                        <div>
                          <h4 className="font-bold text-lg text-gray-800">
                            {review.reviewer_name || 'Anonymous'}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {new Date(review.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <Rate disabled allowHalf value={review.rating} style={{ fontSize: 22, color: '#9333ea' }} />
                    </div>

                    {review.review_text && (
                      <p className="text-gray-700 leading-relaxed text-lg">{review.review_text}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      <Modal
        title={<h2 className="text-3xl font-bold text-center bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Write Your Review</h2>}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} onFinish={onSubmitReview} layout="vertical" className="mt-8">
          {/* Rating MUST be direct child of Form.Item */}
          <Form.Item
            name="rating"
            rules={[{ required: true, message: t('reviews.rating_required') }]}
            className="text-center mb-4"
            valuePropName="value"
          >
            <Rate allowHalf className="text-4xl" />
          </Form.Item>
          <p className="text-center text-gray-600 mb-6">{t('reviews.rating_question')}</p>

          {!user && (
            <Form.Item name="reviewer_name" rules={[{ required: true, message: t('reviews.name_required') }]}>
              <Input size="large" placeholder={t('reviews.name_placeholder')} />
            </Form.Item>
          )}

          <Form.Item
            name="review_text"
            rules={[
              { required: true, message: t('reviews.text_required') },
              { min: 20, message: t('reviews.text_too_short') } // align with server requirement
            ]}
          >
            <TextArea rows={6} placeholder={t('reviews.text_placeholder')} className="text-lg" />
          </Form.Item>

          <div className="text-center">
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              className="h-14 px-12 text-lg font-bold rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600"
            >
              {t('reviews.submit')}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export default BookReviews;
