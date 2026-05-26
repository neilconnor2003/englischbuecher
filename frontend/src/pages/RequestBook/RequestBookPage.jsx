
import React, { useContext, useState } from 'react';
//import { Form, Input, Button, message } from 'antd';
import { Form, Input, Button, message, AutoComplete, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import axios from 'axios';
import config from '../../config';
import './request-book.css';

const { TextArea } = Input;

export default function RequestBookPage() {
  //const { t } = useTranslation();
  const { t, i18n } = useTranslation();
  const { user } = useContext(AuthContext);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const atLeastOneRule = ({ getFieldValue }) => ({
    validator() {
      const hasISBN13 = !!getFieldValue('isbn13');
      const hasISBN10 = !!getFieldValue('isbn10');
      const hasTitle = !!getFieldValue('title');
      if (hasISBN13 || hasISBN10 || hasTitle) return Promise.resolve();
      return Promise.reject(new Error(t('request.validation_isbn_or_title')));
    },
  });


  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const fetchSuggestions = async (value) => {
    const q = value?.trim();
    if (!q || q.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const res = await axios.get(`${config.API_URL}/api/book-search/suggest`, {
        params: { q }
      });

      const options = (Array.isArray(res.data) ? res.data : []).map(item => ({
        value: item.title,
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {item.cover ? (
              <img
                src={item.cover}
                alt={item.title}
                style={{ width: 32, height: 44, objectFit: 'cover', borderRadius: 4 }}
              />
            ) : null}
            <div>
              <div style={{ fontWeight: 600 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: '#666' }}>
                {[item.author, item.year].filter(Boolean).join(' • ')}
              </div>
            </div>
          </div>
        ),
        raw: item
      }));

      setSuggestions(options);
    } catch (err) {
      console.error('Autocomplete failed:', err);
      //setSuggestions([]);

      // ✅ Better UX: show fallback suggestion
      setSuggestions([
        {
          value,
          label: (
            <div>
              <strong>{value}</strong>
              <div style={{ fontSize: 12 }}>Press enter to request manually</div>
            </div>
          ),
          raw: { title: value }
        }
      ]);

    } finally {
      setLoadingSuggestions(false);
    }
  };


  const handleSuggestionSelect = (_value, option) => {
    const book = option.raw;
    if (!book) return;

    form.setFieldsValue({
      title: book.title || undefined,
      author: book.author || undefined,
      publisher: book.publisher || undefined,
      isbn13: book.isbn13 || undefined,
      isbn10: book.isbn10 || undefined
    });
  };


  // simple debounce
  const handleTitleSearch = (() => {
    let timer;
    return (value) => {
      clearTimeout(timer);
      timer = setTimeout(() => fetchSuggestions(value), 300);
    };
  })();


  const onSubmit = async (vals) => {
    setSubmitting(true);
    try {
      await axios.post(`${config.API_URL}/api/book-requests`, {
        isbn13: vals.isbn13?.trim() || null,
        isbn10: vals.isbn10?.trim() || null,
        title: vals.title?.trim() || null,
        author: vals.author?.trim() || null,
        publisher: vals.publisher?.trim() || null,
        notes: vals.notes?.trim() || null,
        requester_name: user ? null : vals.requester_name?.trim(),
        requester_email: user ? null : vals.requester_email?.trim(),
      });
      message.success(t('request.submitted'));
      form.resetFields();
    } catch (err) {
      message.error(t('request.submit_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="request-book-page">
      <div className="request-container">
        <h1 className="request-title">{t('request.page_title')}</h1>

        <p className="request-subtitle">
          {i18n.resolvedLanguage === 'de'
            ? 'Finde dein Buch nicht? Frag es einfach an – wir helfen dir schnell.'
            : 'Didn’t find your book? Just request it — we’ll help you quickly.'}
        </p>

        <div className="request-box">
          <Form form={form} layout="vertical" onFinish={onSubmit} className="request-form">
            {!user && (
              <>
                <Form.Item
                  label={t('request.name')}
                  name="requester_name"
                  rules={[{ required: true, message: t('request.name_required') }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label={t('request.email')}
                  name="requester_email"
                  rules={[
                    { required: true, message: t('request.email_required') },
                    { type: 'email', message: t('request.email_invalid') }
                  ]}
                >
                  <Input />
                </Form.Item>
              </>
            )}

            <Form.Item label={t('request.isbn13')} name="isbn13">
              <Input placeholder="978..." />
            </Form.Item>

            <Form.Item label={t('request.isbn10')} name="isbn10">
              <Input placeholder="0-..." />
            </Form.Item>

            {/*<Form.Item label={t('request.title')} name="title" rules={[atLeastOneRule]}>
              <Input placeholder={t('request.title_placeholder')} />
            </Form.Item>*/}

            <Form.Item label={t('request.title')} name="title" rules={[atLeastOneRule]}>

              <AutoComplete
                options={suggestions}
                onSearch={handleTitleSearch}
                onSelect={handleSuggestionSelect}
                notFoundContent={loadingSuggestions ? <Spin size="small" /> : 'No results'}
              >
                <Input
                  placeholder={t('request.title_placeholder')}
                  suffix={loadingSuggestions ? <Spin size="small" /> : null}
                />

                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  {i18n.resolvedLanguage === 'de'
                    ? 'Tippe mindestens 2 Buchstaben für Vorschläge'
                    : 'Type at least 2 characters for suggestions'}
                </div>

              </AutoComplete>
            </Form.Item>


            <Form.Item label={t('request.author')} name="author">
              <Input />
            </Form.Item>

            <Form.Item label={t('request.publisher')} name="publisher">
              <Input />
            </Form.Item>

            <Form.Item
              label={t('request.notes')}
              name="notes"
              className="ant-form-item-textarea"
            >
              <TextArea rows={3} />
            </Form.Item>

            <div className="request-actions">
              <Button type="primary" htmlType="submit" loading={submitting}>
                {t('request.submit')}
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
