import { useCallback, useMemo, useState } from 'react';
import PaymentErrorDialog from '@/components/PaymentErrorDialog';
import { getPaymentErrorMessage } from '@/services/apiError';

export function usePaymentErrorDialog() {
  const [message, setMessage] = useState('');
  const closePaymentError = useCallback(() => setMessage(''), []);
  const showPaymentError = useCallback((error: unknown, fallback: string) => {
    setMessage(getPaymentErrorMessage(error, fallback));
  }, []);
  const paymentErrorDialog = useMemo(() => (
    <PaymentErrorDialog
      visible={Boolean(message)}
      message={message}
      onClose={closePaymentError}
    />
  ), [closePaymentError, message]);

  return { closePaymentError, paymentErrorDialog, showPaymentError };
}
