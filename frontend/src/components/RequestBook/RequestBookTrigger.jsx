{/*
import React, { useContext, useState } from 'react';
import { Modal, Form, Input, message, Button } from 'antd';
import { PlusOutlined, BookOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import './request-book.css';

const { TextArea } = Input;

export default function RequestBookTrigger() {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const openModal = () => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    form.resetFields();
  };

  const atLeastOneRule = ({ getFieldValue }) => ({
    validator() {
      const hasISBN13 = !!getFieldValue('isbn13');
      const hasISBN10 = !!getFieldValue('isbn10');
      const hasTitle = !!getFieldValue('title');
      if (hasISBN13 || hasISBN10 || hasTitle) return Promise.resolve();
      return Promise.reject(new Error(t('request.validation_isbn_or_title')));
    },
  });

  const onSubmit = async (vals) => {
    setSubmitting(true);
    try {
      await axios.post(
        `${config.API_URL}/api/book-requests`,
        {
          isbn13: vals.isbn13?.trim() || null,
          isbn10: vals.isbn10?.trim() || null,
          title: vals.title?.trim() || null,
          author: vals.author?.trim() || null,
          publisher: vals.publisher?.trim() || null,
          notes: vals.notes?.trim() || null,
        },
        { withCredentials: true }
      );
      message.success(t('request.submitted'));
      closeModal();
    } catch (err) {
      console.error('Book request submit failed:', err?.response?.data || err?.message);
      message.error(t('request.submit_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Header button (desktop) */}
{/*}      <Button
        type="default"
        className="request-book-btn"
        icon={<BookOutlined />}
        onClick={openModal}
      >
        {t('request.button')}
      </Button>

      {/* Floating Action Button (mobile) */}
{/*}      <button className="request-book-fab" onClick={openModal} aria-label={t('request.button')}>
        <PlusOutlined />
      </button>

      {/* Modal form */}
{/*}      <Modal
        open={open}
        title={t('request.modal_title')}
        onCancel={closeModal}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item label={t('request.isbn13')} name="isbn13">
            <Input placeholder="978..." allowClear />
          </Form.Item>

          <Form.Item label={t('request.isbn10')} name="isbn10">
            <Input placeholder="0-..." allowClear />
          </Form.Item>

          <Form.Item
            label={t('request.title')}
            name="title"
            rules={[atLeastOneRule]}
          >
            <Input placeholder={t('request.title_placeholder')} allowClear />
          </Form.Item>

          <Form.Item label={t('request.author')} name="author">
            <Input allowClear />
          </Form.Item>

          <Form.Item label={t('request.publisher')} name="publisher">
            <Input allowClear />
          </Form.Item>

          <Form.Item label={t('request.notes')} name="notes">
            <TextArea rows={3} allowClear />
          </Form.Item>

          <div className="request-actions">
            <Button onClick={closeModal}>{t('cancel')}</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {t('request.submit')}
            </Button>
          </div>
        </Form>
      </Modal>
    </>
  );
}
*/}