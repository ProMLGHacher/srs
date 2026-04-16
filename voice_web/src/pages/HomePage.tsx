import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { PreJoinDialog } from "@/components/PreJoinDialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createRoom } from "@/api/rooms"
import { setPendingJoinStream } from "@/lib/joinTransfer"
import { parseRoomIdInput } from "@/lib/parseRoomId"

export function HomePage() {
  const navigate = useNavigate()
  const [joinInput, setJoinInput] = useState("")
  const [prejoinOpen, setPrejoinOpen] = useState(false)
  const [prejoinRoomId, setPrejoinRoomId] = useState("")

  const createMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: (roomId) => {
      setPrejoinRoomId(roomId)
      setPrejoinOpen(true)
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Не удалось создать комнату")
    },
  })

  const openJoinFlow = (): void => {
    const id = parseRoomIdInput(joinInput)
    if (!id) {
      toast.error("Введите код комнаты (16 символов) или ссылку с /room/…")
      return
    }
    setPrejoinRoomId(id)
    setPrejoinOpen(true)
  }

  const handlePrejoinJoin = (p: {
    stream: MediaStream
    nickname: string
    micOn: boolean
    camOn: boolean
  }): void => {
    setPendingJoinStream(p.stream)
    setPrejoinOpen(false)
    navigate(`/room/${prejoinRoomId}`, {
      state: { nickname: p.nickname, micOn: p.micOn, camOn: p.camOn },
    })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-8 px-4 py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Видеокомнаты</h1>
        <p className="text-sm text-muted-foreground">Создайте комнату или присоединитесь по ссылке или коду</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Новая комната</CardTitle>
          <CardDescription>Сервер выдаст идентификатор; затем настройте камеру и имя</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Создание…" : "Создать комнату"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Присоединиться</CardTitle>
          <CardDescription>Вставьте полную ссылку или только код комнаты</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="join-input">Ссылка или код</Label>
            <Input
              id="join-input"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="https://…/room/… или hex-код"
              onKeyDown={(e) => e.key === "Enter" && openJoinFlow()}
            />
          </div>
          <Button type="button" variant="secondary" className="w-full" onClick={openJoinFlow}>
            Далее
          </Button>
        </CardContent>
      </Card>

      <PreJoinDialog
        open={prejoinOpen}
        onOpenChange={setPrejoinOpen}
        roomId={prejoinRoomId}
        onJoin={handlePrejoinJoin}
      />
    </div>
  )
}
