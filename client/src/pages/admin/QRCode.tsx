import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  QrCode,
  RefreshCw,
  Copy,
  Download
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export default function AdminQRCode() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: qrSetting, refetch } = trpc.qr.getActive.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const generateMutation = trpc.qr.generate.useMutation({
    onSuccess: (data) => {
      toast.success('새 QR 코드가 생성되었습니다.');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // QR 코드 생성
  useEffect(() => {
    if (qrSetting && canvasRef.current) {
      const qrUrl = `${window.location.origin}/qr-scan?code=${qrSetting.secretKey}`;
      QRCode.toCanvas(canvasRef.current, qrUrl, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 300,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      }).catch((err: Error) => {
        console.error('QR 코드 생성 실패:', err);
      });
    }
  }, [qrSetting]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    window.location.href = "/admin/login";
    return null;
  }

  const qrUrl = qrSetting 
    ? `${window.location.origin}/qr-scan?code=${qrSetting.secretKey}`
    : null;

  const handleCopy = () => {
    if (qrUrl) {
      navigator.clipboard.writeText(qrUrl);
      toast.success('URL이 복사되었습니다.');
    }
  };

  const handleCopyCode = () => {
    if (qrSetting?.secretKey) {
      navigator.clipboard.writeText(qrSetting.secretKey);
      toast.success('코드가 복사되었습니다.');
    }
  };

  const handleDownload = () => {
    if (canvasRef.current) {
      const link = document.createElement('a');
      link.href = canvasRef.current.toDataURL('image/png');
      link.download = `hakji-qr-code-${qrSetting?.secretKey}.png`;
      link.click();
      toast.success('QR 코드가 다운로드되었습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container flex items-center h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin')}
            className="mr-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold">QR 코드 관리</h1>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* QR Info Card */}
        <Card className="elegant-card overflow-hidden">
          <div className="bg-gradient-to-r from-cyan-500/10 to-primary/10 p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/80 flex items-center justify-center">
                <QrCode className="w-7 h-7 text-cyan-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  출석체크 QR 코드
                </h2>
                <p className="text-sm text-muted-foreground">
                  학생회실에 부착할 QR 코드를 관리합니다
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Current QR */}
        <Card className="elegant-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">현재 활성 QR 코드</CardTitle>
            <CardDescription>
              사용자가 이 QR을 스캔하면 출석 페이지로 이동합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {qrSetting ? (
              <>
                {/* QR Code Display */}
                <div className="flex flex-col items-center p-6 rounded-xl bg-white border border-border">
                  <canvas 
                    ref={canvasRef}
                    className="rounded-lg border border-border"
                  />
                  <p className="text-xs text-muted-foreground text-center mt-4">
                    이 QR 코드를 학생회실에 부착하세요
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="mt-4"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    다운로드
                  </Button>
                </div>

                {/* Secret Key */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">시크릿 코드</label>
                  <div className="flex gap-2">
                    <div className="flex-1 p-3 rounded-lg bg-muted font-mono text-sm break-all">
                      {qrSetting.secretKey}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyCode}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* URL */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">출석 URL</label>
                  <div className="flex gap-2">
                    <div className="flex-1 p-3 rounded-lg bg-muted text-sm break-all">
                      {qrUrl}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopy}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Last Rotated */}
                <div className="text-sm text-muted-foreground">
                  마지막 갱신: {new Date(qrSetting.lastRotated).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <QrCode className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>활성화된 QR 코드가 없습니다.</p>
                <p className="text-sm">새 QR 코드를 생성해주세요.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Generate New QR */}
        <Card className="elegant-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">QR 코드 갱신</CardTitle>
            <CardDescription>
              보안을 위해 주기적으로 QR 코드를 갱신하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="w-full"
            >
              {generateMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  생성 중...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  새 QR 코드 생성
                </span>
              )}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
