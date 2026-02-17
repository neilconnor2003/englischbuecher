
// frontend/src/pages/Profile/ProfilePage.jsx
import React, { useContext, useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Card, Avatar, Button, Tabs, Tag, Spin, Form, Input, message, Modal, Typography, Pagination, Image,
  Select, Upload
} from 'antd';
import {
  UserOutlined, MailOutlined, HomeOutlined, ShoppingOutlined,
  EditOutlined, CameraOutlined, SaveOutlined, LockOutlined, CalendarOutlined,
  ClockCircleOutlined, CarOutlined, CheckCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import axios from 'axios';
import './ProfilePage.css';
import { useDispatch } from 'react-redux';
import { addItem, syncAdd } from '../../features/cart/cartSlice';
import { toast } from 'react-toastify';

const { Title, Text } = Typography;

const ProfilePage = () => {
  const { t } = useTranslation();
  const { user: authUser, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [form] = Form.useForm();
  const [editModal, setEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState('1');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const dispatch = useDispatch();

  // Axios instance
  const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
  });

  // Normalize a photo URL if the backend returns a relative path like "/uploads/..."
  const normalizePhotoUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return `${window.location.origin}${url}`;
    return url;
  };

  // Member since
  const memberSince = authUser?.email_verified_at
    ? new Date(authUser.email_verified_at)
    : authUser?.created_at
      ? new Date(authUser.created_at)
      : new Date();
  const memberDate = memberSince.toLocaleDateString('de-DE');

  // Only set src when there is a real photo; otherwise let Avatar render initials
  const rawPhoto = normalizePhotoUrl(authUser?.photoURL);
  const hasPhoto = !!rawPhoto; // or: const hasPhoto = authUser?.custom_pic === 1;
  const profilePicSrc = hasPhoto ? rawPhoto : undefined;

  // === PHOTO UPLOAD ===
  const beforeUpload = (file) => {
    const isImage = file.type?.startsWith('image/');
    if (!isImage) {
      message.error(t('only_images_allowed') || 'Please upload an image file');
      return Upload.LIST_IGNORE;
    }
    const isLt2M = file.size / 1024 / 1024 < 2; // 2MB
    if (!isLt2M) {
      message.error(t('image_too_large') || 'Image must be smaller than 2 MB');
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const customPhotoUpload = async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('photo', file);

      // Backend should return: { photoURL: "<absolute or relative url>" }
      const { data } = await api.post('/user/profile-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newPhotoURL = normalizePhotoUrl(data.photoURL);

      updateUser({ ...authUser, photoURL: newPhotoURL, custom_pic: 1 });

      message.success(t('profile_photo_updated') || 'Profile photo updated!');
      onSuccess?.(data, file);
    } catch (err) {
      console.error('Profile photo upload failed:', err);
      message.error(t('failed_to_upload_photo') || 'Failed to upload photo');
      onError?.(err);
    }
  };

  const handleReorder = async (order) => {
    if (!order.order_items_parsed || order.order_items_parsed.length === 0) {
      toast.error(t('no_items_to_reorder'));
      return;
    }
    try {
      order.order_items_parsed.forEach(item => {
        dispatch(addItem({
          bookId: item.bookId,
          book: {
            title_en: item.title_en,
            price: item.price,
            image: item.image
          },
          quantity: item.quantity
        }));
        dispatch(syncAdd({ bookId: item.bookId, quantity: item.quantity }));
      });
      toast.success(t('items_readded_to_cart'));
    } catch (err) {
      console.error('Reorder failed:', err);
      toast.error(t('reorder_failed'));
    }
  };

  // === AUTO-OPEN TAB FROM URL HASH ===
  useEffect(() => {
    if (location.hash === '#orders') {
      setActiveTab('2'); // My Orders tab
    } else {
      setActiveTab('1'); // Personal Data
    }
  }, [location.hash]);

  // === FETCH ORDERS ===
  const fetchOrders = async (page = 1) => {
    setOrderLoading(true);
    try {
      const { data } = await api.get('/orders/my-orders');

      const ordersWithItems = data.map(order => {
        let parsed = [];
        try {
          if (order.order_items != null && order.order_items !== '') {
            parsed = JSON.parse(order.order_items);
          }
        } catch (err) {
          console.warn(`Failed to parse order_items for order ${order.id}:`, err);
        }

        return {
          ...order,
          order_items_parsed: Array.isArray(parsed) ? parsed : []
        };
      });

      setOrders(ordersWithItems);
      setCurrentPage(page);
    } catch (err) {
      message.error(t('failed_to_load_orders'));
    } finally {
      setOrderLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(1);
  }, []);

  // === SAVE PROFILE ===
  const handleSave = async (values) => {
    setLoading(true);
    try {
      const { data } = await api.put('/user/profile', values);
      updateUser(data); // ideally server recomputes initials if name changes
      message.success(t('profile_updated'));
      setEditModal(false);
    } catch (err) {
      message.error((t('update_failed') || 'Update failed') + ': ' + (err.response?.data?.error || 'Server error'));
    } finally {
      setLoading(false);
    }
  };

  // === STATUS ICON + TEXT HELPER ===
  const getStatusIcon = (status) => {
    const iconStyle = { marginRight: 6 };
    switch (status) {
      case 'pending':
        return (
          <>
            <ClockCircleOutlined style={{ ...iconStyle, color: '#fa8c16' }} />
            <span style={{ fontWeight: 500 }}>{t('pending')}</span>
          </>
        );
      case 'processing':
        return (
          <>
            <ClockCircleOutlined style={{ ...iconStyle, color: '#1890ff' }} />
            <span style={{ fontWeight: 500 }}>{t('processing')}</span>
          </>
        );
      case 'shipped':
        return (
          <>
            <CarOutlined style={{ ...iconStyle, color: '#52c41a' }} />
            <span style={{ fontWeight: 500 }}>{t('shipped')}</span>
          </>
        );
      case 'delivered':
        return (
          <>
            <CheckCircleOutlined style={{ ...iconStyle, color: '#52c41a' }} />
            <span style={{ fontWeight: 500 }}>{t('delivered')}</span>
          </>
        );
      case 'cancelled':
        return (
          <>
            <CloseCircleOutlined style={{ ...iconStyle, color: '#f5222d' }} />
            <span style={{ fontWeight: 500 }}>{t('cancelled')}</span>
          </>
        );
      default:
        return (
          <>
            <ClockCircleOutlined style={{ ...iconStyle, color: '#d9d9d9' }} />
            <span style={{ color: '#999' }}>{t('unknown')}</span>
          </>
        );
    }
  };

  // === PAGINATED ORDERS ===
  const paginatedOrders = orders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Build Tabs items (AntD v5)
  const tabItems = useMemo(() => ([
    {
      key: '1',
      label: (<span><UserOutlined /> {t('personal_data')}</span>),
      children: (
        <div className="profile-section">
          <Title level={4}><HomeOutlined /> {t('personal_information')}</Title>
          <div className="info-grid">
            <div><Text strong>{t('first_name')}:</Text> {authUser?.first_name || '-'}</div>
            <div><Text strong>{t('last_name')}:</Text> {authUser?.last_name || '-'}</div>
            <div><Text strong>{t('email')}:</Text> {authUser?.email}</div>
            <div><Text strong>{t('language')}:</Text> {authUser?.language === 'de' ? 'Deutsch' : 'English'}</div>
          </div>
          <Button type="primary" icon={<EditOutlined />} onClick={() => setEditModal(true)} style={{ marginTop: 16 }}>
            {t('edit_profile')}
          </Button>
        </div>
      )
    },
    {
      key: '2',
      label: (<span><ShoppingOutlined /> {t('my_orders')}</span>),
      children: (
        <div className="profile-section">
          {orderLoading ? (
            <Spin />
          ) : orders.length === 0 ? (
            <div className="empty-orders">
              <Text type="secondary">{t('no_orders_yet')}</Text>
              <Button type="link" onClick={() => navigate('/')}>
                {t('start_shopping_now')}
              </Button>
            </div>
          ) : (
            <>
              <div className="orders-list">
                {paginatedOrders.map(order => (
                  <div key={order.id} className="order-card">
                    {/* Header */}
                    <div className="order-card-header" onClick={e => e.stopPropagation()}>
                      <div className="order-id-date">
                        <Text strong>#{order.id}</Text>
                        <Text type="secondary" className="order-date">
                          {new Date(order.created_at).toLocaleDateString('de-DE')}
                        </Text>
                      </div>
                      <div className="order-actions">
                        <Button
                          type="link"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/order-success/${order.id}`);
                          }}
                          className="view-btn"
                        >
                          {t('view')} →
                        </Button>
                        {/* Optional reorder button can be added here calling handleReorder(order) */}
                      </div>
                    </div>

                    {/* Body */}
                    <div className="order-card-body">
                      <div className="order-thumbnails">
                        {order.order_items_parsed.slice(0, 3).map((item, idx) => (
                          <Image
                            key={idx}
                            src={item.image}
                            width={36}
                            height={36}
                            preview={false}
                            style={{ borderRadius: 6, objectFit: 'cover' }}
                          />
                        ))}
                        {order.order_items_parsed.length > 3 && (
                          <Text type="secondary" style={{ marginLeft: 8, fontSize: '0.8rem' }}>
                            +{order.order_items_parsed.length - 3}
                          </Text>
                        )}
                      </div>

                      <div className="order-info">
                        <Text strong>€{Number(order.total).toFixed(2)}</Text>
                        <div className="order-status">
                          {getStatusIcon(order.status)}
                          <Tag color={order.is_paid ? 'green' : 'red'} style={{ marginLeft: 6 }}>
                            {order.is_paid ? t('paid') : t('pending')}
                          </Tag>
                        </div>

                        {/* Shipping summary (small, inline) */}
                        <div className="order-shipping-mini" style={{ marginTop: 6, fontSize: '0.85rem', color: '#555' }}>
                          {/* cost */}
                          <span>
                            {t('cart.shipping_label') || 'Shipping'}:{' '}
                            <strong>
                              {Number.isFinite(Number(order.shipping_amount_eur))
                                ? `€${Number(order.shipping_amount_eur).toFixed(2)}`
                                : '—'}
                            </strong>
                          </span>
                          {/* provider/service */}
                          {order.shipping_provider ? (
                            <span> · {order.shipping_provider}{order.shipping_service ? ` · ${order.shipping_service}` : ''}</span>
                          ) : null}
                          {/* tracking link */}
                          {order.tracking_number ? (
                            <>
                              {' '}· {t('tracking_number') || 'Tracking'}: <strong>{order.tracking_number}</strong>
                              {order.tracking_url ? (
                                <> · <a href={order.tracking_url} target="_blank" rel="noreferrer">{t('track_package') || 'Track'}</a></>
                              ) : null}
                            </>
                          ) : (
                            <span style={{ color: '#999' }}> · {t('tracking_pending') || 'Label pending'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="pagination-wrapper">
                <Pagination
                  current={currentPage}
                  total={orders.length}
                  pageSize={pageSize}
                  onChange={(page) => setCurrentPage(page)}
                  showSizeChanger={false}
                  responsive
                />
              </div>
            </>
          )}
        </div>
      )
    },
    {
      key: '3',
      label: (<span><LockOutlined /> {t('account_settings')}</span>),
      children: (
        <div className="profile-section">
          <Title level={4}>{t('security')}</Title>
          <Button danger block size="large" style={{ marginBottom: 16 }}>
            {t('change_password')}
          </Button>
          <Button block size="large" style={{ marginBottom: 16 }}>
            {t('two_factor_auth')}
          </Button>
          <Button block size="large" danger>
            {t('delete_account')}
          </Button>
        </div>
      )
    }
  ]), [authUser, t, orderLoading, orders, currentPage, pageSize, navigate]);

  if (!authUser) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <Card className="profile-card">
          {/* HEADER */}
          <div className="profile-header">
            <div className="avatar-wrapper">
              <Avatar
                size={120}
                src={profilePicSrc}
                alt={`${authUser.first_name || ''} ${authUser.last_name || ''}`.trim() || 'Profile'}
                icon={!profilePicSrc ? <UserOutlined /> : undefined}
                onError={() => false}            // ✅ fall back to initials if image fails
                className="profile-avatar profile-avatar--white-purple" // ✅ styling hook
              >
                {authUser?.initials /* ✅ server-provided initials */}
              </Avatar>

              {/* Upload wrapper keeps existing camera button UI */}
              <Upload
                showUploadList={false}
                accept="image/*"
                beforeUpload={beforeUpload}
                customRequest={customPhotoUpload}
              >
                <Button
                  shape="circle"
                  icon={<CameraOutlined />}
                  className="avatar-edit-btn"
                />
              </Upload>
            </div>
            <div className="profile-info">
              <h2>{authUser.first_name} {authUser.last_name}</h2>
              <p><MailOutlined /> {authUser.email}</p>
              <Tag color="purple">
                <CalendarOutlined /> {t('member_since')} {memberDate}
              </Tag>
            </div>
          </div>

          {/* TABS – controlled, AntD v5 */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            centered
            className="profile-tabs"
            items={tabItems}
          />
        </Card>
      </div>

      {/* EDIT MODAL */}
      <Modal
        title={<><EditOutlined /> {t('edit_profile')}</>}
        open={editModal}
        onCancel={() => setEditModal(false)}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            first_name: authUser?.first_name || '',
            last_name: authUser?.last_name || '',
            email: authUser?.email || '',
            language: authUser?.language || 'de',
          }}
        >
          <Form.Item name="first_name" label={t('first_name')} rules={[{ required: true }]}>
            <Input prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item name="last_name" label={t('last_name')}>
            <Input prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item name="email" label={t('email')} rules={[{ required: true, type: 'email' }]}>
            <Input prefix={<MailOutlined />} disabled />
          </Form.Item>
          <Form.Item name="language" label={t('language')}>
            <Select
              options={[
                { value: 'de', label: 'Deutsch' },
                { value: 'en', label: 'English' },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
              {t('save_changes')}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProfilePage;
